// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview This file contains the 'KMOO.Cookie' class, which wraps
 * Chrome's external cookie representation to add a few helper methods
 * for adding, removing, and manipulating cookie data. The file's contents
 * should be imported after KMOO.js, as the class depends upon KMOO's
 * presence.
 *
 * @author mkwst@google.com (Mike West)
 */

/**
 * This class wraps the Chrome `Cookie` object with a few helper methods
 * and mutexes that are necessary because the Cookie API is annoyingly
 * deficient in a few areas. All cookie operations (set or delete)
 * should go through this class.
 *
 * See in particular http://crbug.com/70101 and http://crbug.com/70102
 *
 * @param {!Cookie} c The Chrome `Cookie` object to wrap.
 * @constructor
 */
KMOO.Cookie = function(c) {
  /**
   * The wrapped `Cookie`
   *
   * @type {!Cookie}
   * @private
   */
  this.cookie_ = c;

  /**
   * Cached result of call to `isValid`; see definition of "validity" there
   *
   * @type {boolean}
   * @private
   */
  this.validity_ = null;
};

/**
 * Adding or modifying a cookie generates two events: one for the cookie's
 * deletion (!!!), one for it's addition. This makes no sense, and since
 * I'm attempting to take specific action on deletion (namely, adding the
 * cookie back), I need some sort of locking mechanism here. I'm storing
 * cookies I set here in this object, and ask clients of this library to
 * call `unlock` on a cookie once the addition event comes. This is an
 * annoying hack.
 *
 * Filed as http://code.google.com/p/chromium/issues/detail?id=70101
 *
 * @type {object}
 * @private
 */
KMOO.Cookie.mutexes_ = {};


/**
 * Determines whether a cookie is "valid" (that is, whether it's an opt-out
 * cookie for a domain we do care about). Cookies for domains without
 * explicit policies always return `undefined`, as do cookies that aren't
 * listed in the registry.
 *
 * @return {boolean|undefined} True if it's a valid cookie, false if it's
 *     an invalid cookie, undefined if it's a cookie for a domain we don't
 *     care about.
 */
KMOO.Cookie.prototype.isValid = function() {
  if (this.validity_ === null) {
    // Result is memoized, so check `this.validity_` first.
    var policy = KMOO.PolicyRegistry.getDomainPolicy(this.cookie_.domain);

    // Assume that the cookie's irrelevant, then run checks.
    this.validity_ = undefined;

    if (!policy) {
      // If the cookie is not in a domain we care about, return early.
      return this.validity_;
    }

    // Loop through the policies for this domain; if the cookie's name is one
    // that we care about, then the cookie is valid iff its value is correct.
    for (var i = policy.length - 1; i >= 0; i--) {
      if (this.cookie_.name === policy[i].name) {
        this.validity_ = (this.cookie_.value === policy[i].value);
      }
    }
  }
  return this.validity_;
};


/**
 * Sets a browser cookie using this object's wrapped `Cookie` data.
 */
KMOO.Cookie.prototype.set = function() {
  var policy = KMOO.PolicyRegistry.getDomainPolicy(this.cookie_.domain);
  var self = this;
  if (!this.isLocked()) {
    for (var i = policy.length - 1; i >= 0; i--) {
      // If the cookie isn't locked, request it. If we find a cookie that's
      // already been set with the same domain, name, and value, don't
      // overwrite it. Otherwise we'll get into an exciting infinite loop.
      chrome.cookies.get(
          {
            'url': policy[i].url,
            'name': policy[i].name
          },
          (function(currentPolicy) {
            return function(c) {
              if (c === null || c.value !== currentPolicy.value) {
                (new KMOO.Cookie(currentPolicy)).lock();
                chrome.cookies.set(currentPolicy);
              }
            }
          }(policy[i]))
      );
    }
  } else {
    KMOO.debug('`%s` for `%s` is being set, exiting.',
        this.cookie_.name, this.cookie_.domain);
  }
};


/**
 * Determines whether the cookie is locked.
 *
 * @return {boolean} True if the cookie's locked, false otherwise.
 */
KMOO.Cookie.prototype.isLocked = function() {
  var mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  return !!KMOO.Cookie.mutexes_[mutex];
};

/**
 * Locks a cookie for writing. _MUST_ be called before writing to a cookie.
 * VERY VERY IMPORTANT.
 *
 * Also, this is a hack and ugly ugly ugly. Hate it.
 *
 * @param {object} policy If `policy` is passed in, it is used for the lock
 *     rather than `this.cookie_`. I know, I know...
 */
KMOO.Cookie.prototype.lock = function(policy) {
  var mutex;
  if (policy) {
     mutex = 'name:' + policy.name + 'domain:' + policy.domain;
  } else {
     mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  }
  KMOO.debug('- Locking %s', mutex);
  KMOO.Cookie.mutexes_[mutex] = 1;
};


/**
 * Clears the mutex for a cookie. _MUST_ be called in response to an
 * `onChanged` event with `removed` set to false. VERY VERY IMPORTANT. :)
 */
KMOO.Cookie.prototype.unlock = function() {
  var mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  KMOO.debug('- Unlocking %s', mutex);
  delete KMOO.Cookie.mutexes_[mutex];
};


/**
 * Removes a browser cookie matching this object's wrapped `Cookie` data.
 */
KMOO.Cookie.prototype.remove = function() {
  if (!this.isLocked()) {
    chrome.cookies.remove({
      'url': 'http://' + this.cookie_.domain + this.cookie_.path,
      'name': this.cookie_.name
    });
  } else {
    KMOO.debug("`%s` for `%s` is locked, can't remove.",
        this.cookie_.name, this.cookie_.domain);
  }
};
