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
 *  Singleton that implements the KMOO opt-out logic.  On initialization, it
 *  first walks through the domains in the `KMOO.PolicyRegistry`, removing all
 *  non-opt-out cookies and verifying that the opt-out cookies are in place.
 *  Then, it adds a handler to `chrome.cookies.onChanged` to ensure that the
 *  known-good configuration remains good.
 *
 *  @name KMOO
 *  @namespace
 *  @author mkwst@google.com (Mike West)
 */
var KMOO = (function() {
  /**
   *  Are we in debug mode?
   *
   *  @type {Boolean}
   *  @private
   */
  var isDebugMode_ = true;


  /**
   *  Walk through the domains in the `KMOO.PolicyRegistry`, removing all
   *  non-opt-out cookies, and verifying that the opt-out cookies are in
   *  place.  This ensures that we're in a known-good state.
   *
   *  @private
   */
  function revertOptOutCookies() {
    // First, get all cookies we have access to (per the host restrictions
    // in the manifest file), and remove them all.  This is a bit draconian,
    // but it's effective.
    chrome.cookies.getAll({}, function (cookies) {
      for (var j = cookies.length - 1; j >= 0; j--) {
        var c = new KMOO.Cookie(cookies[j]);
        // Hard code an exclusion for Yahoo's non-opt-out cookies; otherwise
        // we'd log users out of all Yahoo properties every time they started
        // their browser, which probably isn't acceptable.  
        //
        // @TODO: We were originally whitelisting only the `B` cookie.  That
        //        workedforme, but not for others.  Will look into this later.
        if (!c.isValid() &&
            cookies[j].domain !== ".yahoo.com") {
          KMOO.debug( "* Removing `%s` from `%s`",
              cookies[j].name,
              cookies[j].domain);
          c.remove();
        }
      }
    });
    
    // Helper function to generate a callback function for use in
    // `chrome.cookies.get`.  This is a bit complex, but I can't
    // simply create a closure in the `for` loop, as the variables
    // are evaluated too late.  This way, `policy` is always correct
    // inside the callback, no matter when it executes.
    function generateGetCallback(policy) {
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
          generateGetCallback(cur)
        );
      }
    });
  }

  /**
   *  This function is used to handle `chrome.cookies.onChanged` events for
   *  cookies in the domains we care about.  In short, if an opt-out cookie
   *  is removed, this resets it.  If a non-opt-out cookie is set on an opt-out
   *  domain, we remove it.
   *
   *  @param  {Object} e The change info.
   *  @private
   */
  function changeHandler(e) {
    var optout = new KMOO.Cookie(e.cookie);

    // Assuming that we care about the cookie:
    if (optout.isValid() !== undefined) {
      KMOO.debug(
          '* Checking %s cookie `%s` from `%s` (%o)',
          (e.removed ? 'removed' : 'changed/added'),
          e.cookie.name,
          e.cookie.domain,
          e.cookie);
      // If we're _removing_ a _valid_ cookie, add it back:
      if (e.removed && optout.isValid()) {
        KMOO.debug(
            '  * Valid opt-out cookie `%s` was removed from `%s`; recreating in 5s',
            e.cookie.name,
            e.cookie.domain);
        if ( optout.isLocked() ) {
          KMOO.debug( '    * Nevermind, cookie is currently locked.' );
        } else {
          setTimeout((function (optout) {
            return function () {
              optout.set();
            };
          }(optout)), 5000);
        }
      // Or, if we're _adding_ an _invalid_ cookie, remove it:
      } else if (!e.removed && !optout.isValid()) {
        KMOO.debug(
            '  * Invalid opt-out cookie `%s` was added to `%s`; removing it.',
            e.cookie.name,
            e.cookie.domain);
        optout.lock();
        optout.remove();
      // Or, if we're adding/updating a valid cookie, clear the mutex
      } else if (!e.removed && optout.isValid()) {
        KMOO.debug(
            '  * Valid opt-out cookie `%s` was added to `%s`.',
            e.cookie.name,
            e.cookie.domain);
        optout.unlock();
      }
    } else {
      KMOO.debug(
          '  * We don\'t have a policy for `%s` on `%s`.  Ignoring it.',
          e.cookie.name,
          e.cookie.domain);
    }
    optout = null;
  }

  return {
    /**
     *  Initializes opt-out functionality for KMOO, reverting opt-out cookies to
     *  a known-good state, and binding to the `chrome.cookies.onChanged` event
     *  to keep things that way.
     *
     *  @name KMOO.optout
     *  @requires KMOO.Cookie
     *  @requires KMOO.PolicyRegistry
     */
    'optout': function() {
      KMOO.debug('Initializing KMOO Opt-out functionality:');

      KMOO.debug('* Binding handlers to `KMOO.PolicyRegistry`');
      KMOO.PolicyRegistry.onload = function() {
        KMOO.debug('* `KMOOPolicyRegistry` loaded data successfully!');
        KMOO.debug('* Binding handler to `chrome.cookies.onChanged`');
        chrome.cookies.onChanged.addListener(changeHandler);
        KMOO.debug('* Reverting cookies to known-good state');
        revertOptOutCookies();
      };

      KMOO.debug('* Initializing `KMOOPolicyRegistry`');
      KMOO.PolicyRegistry.init();
    },

    /**
     *  Log a debug message to the console, if we're in debug mode.
     */
    'debug': function() {
      if (isDebugMode_) {
        console.log.apply(console, arguments);
      }
    }
  };
}());
