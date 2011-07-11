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
 * @fileoverview This file implements the business logic of the opt-out
 * extension via the KMOO singleton. It relies on KMOO.Cookie and
 * KMOO.PolicyRegistry for some of the heavy lifting, so ensure that those
 * classes are included as well.
 *
 * @author mkwst@google.com (Mike West)
 */

/**
 * Singleton that implements the KMOO opt-out logic. On initialization, it
 * first walks through the domains in the `KMOO.PolicyRegistry`, removing all
 * non-opt-out cookies and verifying that the opt-out cookies are in place.
 * Then, it adds a handler to `chrome.cookies.onChanged` to ensure that the
 * known-good configuration remains good.
 */
var KMOO = {};

/**
 * Are we in debug mode?
 *
 * @type {boolean}
 * @private
 */
KMOO.isDebugMode_ = false;


/**
 * Walks through the domains in the `KMOO.PolicyRegistry`, removing all
 * non-opt-out cookies, and verifying that the opt-out cookies are in
 * place. This ensures that we're in a known-good state.
 *
 * @private
 */
KMOO.revertOptOutCookies_ = function() {
  // First, get all cookies we have access to (per the host restrictions
  // in the manifest file), and remove all malformed opt-out cookies.
  chrome.cookies.getAll({}, function(cookies) {
    for (var j = cookies.length - 1; j >= 0; j--) {
      var c = new KMOO.Cookie(cookies[j]);

      if (c.isValid() === false) {
        KMOO.debug('* Removing invalid `%s` (`%s`) from `%s`',
            cookies[j].name,
            cookies[j].value,
            cookies[j].domain);
        c.remove();
      }
    }
  });

  // Helper function to generate a callback function for use in
  // `chrome.cookies.get`. This is a bit complex, but I can't
  // simply create a closure in the `for` loop, as the variables
  // are evaluated too late. This way, `policy` is always correct
  // inside the callback, no matter when it executes.
  function generateGetCallback_(policy) {
    return function(cookie) {
      var optout = new KMOO.Cookie(policy);
      if (cookie === null) {
        KMOO.debug(
            '  * Missing Opt-out cookie `%s` for `%s`: Adding',
            policy.name,
            policy.domain);
        optout.set();
      } else if (cookie.name === policy.name &&
          cookie.value !== policy.value) {
        KMOO.debug(
            '  * Malformed Opt-out cookie `%s` for `%s`: `%s` !== `%s`',
            policy.name,
            policy.domain,
            policy.value,
            cookie.value);
        optout.set();
      }
      optout = null;
    };
  }
  KMOO.PolicyRegistry.forEach(function(policy, domain) {
    // Try to get the opt-out cookie, and use `generateGetCallback`
    // to create a callback function to handle the `get` response
    for (var i = policy.length - 1; i >= 0; i--) {
      var cur = policy[i];
      chrome.cookies.get(
        {
          'url': cur.url,
          'name': cur.name
        },
        generateGetCallback_(cur)
      );
    }
  });
};

/**
 * Handles `chrome.cookies.onChanged` events for cookies in the domains we
 * care about. In short, if an opt-out cookie is removed, this resets it.
 * If a non-opt-out cookie is set on an opt-out domain, we remove it.
 *
 * @param {Object} e The change info.
 * @private
 */
KMOO.changeHandler_ = function(e) {
  var optout = new KMOO.Cookie(e.cookie);

  if (optout.isValid() !== undefined) {
    // We only want to process cookies that are either explicitly valid or
    // invalid. 'undefined' cookies are to be ignored.
    KMOO.debug(
        '* Checking %s cookie `%s` from `%s` (%o)',
        (e.removed ? 'removed' : 'changed/added'),
        e.cookie.name,
        e.cookie.domain,
        e.cookie);
    if (e.removed && optout.isValid()) {
      // If we're _removing_ a _valid_ cookie, add it back.
      KMOO.debug(
          '  * Valid opt-out cookie `%s` removed from `%s`; recreating in 5s',
          e.cookie.name,
          e.cookie.domain);
      if (optout.isLocked()) {
        KMOO.debug('    * Nevermind, cookie is currently locked.');
      } else {
        setTimeout((function(optout) {
          return function() {
            optout.set();
          };
        }(optout)), 5000);
      }
    } else if (!e.removed && !optout.isValid()) {
      // Or, if we're _adding_ an _invalid_ cookie, remove it.
      KMOO.debug(
          '  * Invalid opt-out cookie `%s` was added to `%s`; removing it.',
          e.cookie.name,
          e.cookie.domain);
      optout.lock();
      optout.remove();
    } else if (!e.removed && optout.isValid()) {
      // Or, if we're _adding_ or _updating_ a _valid_ cookie, clear the mutex.
      KMOO.debug(
          '  * Valid opt-out cookie `%s` was added to `%s`.',
          e.cookie.name,
          e.cookie.domain);
      optout.unlock();
    }
  } else {
    KMOO.debug(
        '  * We don\'t have a policy for `%s` on `%s`. Ignoring it.',
        e.cookie.name,
        e.cookie.domain);
  }
  optout = null;
};

/**
 * Initializes opt-out functionality for KMOO, reverting opt-out cookies to
 * a known-good state, and binding to the `chrome.cookies.onChanged` event
 * to keep things that way.
 */
KMOO.optout = function() {
  KMOO.debug('Initializing KMOO Opt-out functionality:');

  KMOO.debug('* Binding handlers to `KMOO.PolicyRegistry`');
  KMOO.PolicyRegistry.onload = function() {
    KMOO.debug('* `KMOOPolicyRegistry` loaded data successfully!');
    KMOO.debug('* Binding handler to `chrome.cookies.onChanged`');
    chrome.cookies.onChanged.addListener(KMOO.changeHandler_);
    KMOO.debug('* Reverting cookies to known-good state');
    KMOO.revertOptOutCookies_();
  };

  KMOO.debug('* Initializing `KMOOPolicyRegistry`');
  KMOO.PolicyRegistry.init();
};

/**
 * Logs a debug message to the console, if we're in debug mode.
 */
KMOO.debug = function() {
  if (KMOO.isDebugMode_) {
    console.log.apply(console, arguments);
  }
};
