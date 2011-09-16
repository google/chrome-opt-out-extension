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
 * Firefox's external cookie representation to add a few helper methods
 * for adding, removing, and manipulating cookie data. The file's contents
 * should be imported after KMOO.js, as the class depends upon KMOO's
 * presence.
 *
 * @author mkwst@google.com (Mike West)
 * @author eisinger@google.com (Jochen Eisinger)
 */

/**
 * This class wraps the nsICookie object with a few helper methods.  All
 * cookie operations (set or delete) should go through this class.
 *
 * @param {!Cookie} c The nsICookie object to wrap.
 * @constructor
 */
KMOO.Cookie = function(c) {
  /**
   * The wrapped nsICookie
   *
   * @type {!nsICookie}
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
 * Returns the domain of the cookie.
 *
 * @return {string} The domain of the wrapped nsICookie.
 */
KMOO.Cookie.prototype.domain = function() {
  var domain = this.cookie_.host;
  if (domain[0] != '.') {
    domain = '.' + domain;
  }
  return domain;
}

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
    var policy = KMOO.PolicyRegistry.getDomainPolicy(this.domain());

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
  var ios = Components.classes['@mozilla.org/network/io-service;1'].
      getService(Components.interfaces.nsIIOService);
  var cookieSvc = Components.classes['@mozilla.org/cookieService;1'].
      getService(Components.interfaces.nsICookieService);
  var cookieUri = ios.newURI(
      'http://' + this.cookie_.host + this.cookie_.path, null, null);
  var cookie = this.cookie_.name + '=' + this.cookie_.value +
      ';expires=10 November 2030 00:59:06;';
  if (this.cookie_.isDomain) {
    cookie += 'domain=.' + this.cookie_.host + ';';
  }
  cookieSvc.setCookieString(cookieUri, null, cookie, null);
};

/**
 * Removes a browser cookie matching this object's wrapped `Cookie` data.
 */
KMOO.Cookie.prototype.remove = function() {
  var cookieMng = Components.classes['@mozilla.org/cookiemanager;1'].
      getService(Components.interfaces.nsICookieManager);
  cookieMng.remove(
      this.cookie_.host, this.cookie_.name, this.cookie_.path, false);
};
