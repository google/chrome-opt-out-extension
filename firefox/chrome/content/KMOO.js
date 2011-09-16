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
 * @author eisinger@google.com (Jochen Eisinger)
 */

/**
 * Singleton that implements the KMOO opt-out logic. On initialization, it
 * first walks through the domains in the `KMOO.PolicyRegistry`, removing all
 * non-opt-out cookies and verifying that the opt-out cookies are in place.
 * Then, it adds a handler to 'cookie-changed' to ensure that the known-good
 * configuration remains good.
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
  // First, get all cookies, and remove all malformed opt-out cookies.
  var cookieMng = Components.classes["@mozilla.org/cookiemanager;1"].
      getService(Components.interfaces.nsICookieManager);
  var cookies = cookieMng.enumerator;

  while (cookies.hasMoreElements()) {
    var cookie = cookies.getNext();
    if (cookie instanceof Components.interfaces.nsICookie) {
      var c = new KMOO.Cookie(cookie);

      if (c.isValid() === false) {
        KMOO.debug(
            "* Removing invalid `" + cookie.name + "` (`" + cookie.value +
            "`) from `" + c.domain() + "`");
        c.remove();
      }
    }
  }

  KMOO.PolicyRegistry.forEach(function(policy, domain) {
    for (var i = policy.length - 1; i >= 0; i--) {
      var c = new KMOO.Cookie(policy[i]);
      c.set();
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
 *  This function is used to handle `cookie-changed` events for cookies in
 *  the domains we care about.  In short, if an opt-out cookie is removed,
 *  this resets it.  If a non-opt-out cookie is set on an opt-out domain, we
 *  remove it.
 *
 *  @param  {Object} subject either a nsICookie or an nsIArray of nsICookie
 *      objects
 *  @param  {string} topic "cookie-changed"
 *  @param  {string} data A keyword indicating what was done
 *  @private
 */
KMOO.observe = function(subject, topic, data) {

  // Helper function to handle a single cookie.
  function handleCookie(c, data) {
    var optout = new KMOO.Cookie(c);

    // Assuming that we care about the cookie:
    if (optout.isValid() !== undefined) {
      KMOO.debug(
          '* Checking ' +
          (data == 'deleted' ? 'removed' : 'changed/added') +
          ' cookie `' + c.name + '` from `' + c.host + '`');

      // If we're _removing_ a _valid_ cookie, add it back:
      if (data == 'deleted' && optout.isValid()) {
        KMOO.debug('  * Valid opt-out cookie `' + c.name +
                   '` was removed from `' + c.host + '`; recreating');
        optout.set();

      // Or, if we're _adding_ an _invalid_ cookie, remove it:
      } else if (data != 'deleted' && !optout.isValid()) {
        KMOO.debug('  * Invalid opt-out cookie `' + c.name +
                   '` was added to `' + c.host + '`; removing it.');
        optout.remove();

        // An opt out cookie might have been overriden by this, so reset all
        // opt out cookies for this domain.
        var policy = KMOO.PolicyRegistry.getDomainPolicy(optout.domain());

        // If the cookie is in a domain we care about, do some checks:
        if (policy) {
          // Loop through the policies for this domain
          for (var i = policy.length - 1; i >= 0; i--) {
            var cl = new KMOO.Cookie(policy[i]);
            cl.set();
          }
        }
      }
    } else {
      KMOO.debug('  * We don\'t have a policy for `' + c.name + '` on `' +
                 c.host + '`.  Ignoring it.');
    }
    optout = null;
  }

  if (topic != "cookie-changed") {
    return;
  }

  if (data == "cleared" || data == "reload") {
    KMOO.revertOptOutCookies_();
  } else if (data == "batch-deleted") {
    var cookies = subject.enumerate();
    while (cookies.hasMoreElements()) {
      var cookie = cookies.getNext();
      if (cookie instanceof Components.interfaces.nsICookie) {
        handleCookie(cookie, "deleted");
      }
    }
  } else {
    if (subject instanceof Components.interfaces.nsICookie) {
      handleCookie(subject, data);
    }
  }
};

/**
 *  Initializes opt-out functionality for KMOO, reverting opt-out cookies
 *  to a known-good state, and binding to the `cookie-changed` event to
 *  keep things that way.
 */
KMOO.optout = function() {
  KMOO.debug('Initializing KMOO Opt-out functionality:');

  KMOO.debug('* Binding handlers to `KMOO.PolicyRegistry`');
  KMOO.PolicyRegistry.onload = function() {
    KMOO.debug('* `KMOOPolicyRegistry` loaded data successfully!');
    KMOO.debug('* Binding handler to `cookie-changed` event');
    Components.classes['@mozilla.org/observer-service;1'].
        getService(Components.interfaces.nsIObserverService).
        addObserver(KMOO, 'cookie-changed', false);
    KMOO.debug('* Reverting cookies to known-good state');
    KMOO.revertOptOutCookies_();
  };
  KMOO.PolicyRegistry.onerror = KMOO.debug;

  KMOO.debug('* Initializing `KMOOPolicyRegistry`');
  KMOO.PolicyRegistry.init();
};

/**
 * Logs a debug message to the console, if we're in debug mode.
 */
KMOO.debug = function(aMsg) {
  if (KMOO.isDebugMode_) {
    dump(aMsg + "\n");
  }
};
