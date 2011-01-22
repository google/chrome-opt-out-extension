// Copyright 2011 Google Inc. All rights reserved.
/**
 *  Singleton that implements the NAI opt-out logic.  On initialization, it
 *  first walks through the domains in the `NAIPolicyRegistry`, removing all
 *  non-opt-out cookies and verifying that the opt-out cookies are in place.
 *  Then, it adds a handler to `chrome.cookies.onChanged` to ensure that the
 *  known-good configuration remains good.
 *
 *  @name NAI
 *  @namespace
 *  @author mkwst@google.com (Mike West)
 */
var NAI = (function() {
  /**
   *  Are we in debug mode?
   *
   *  @type {Boolean}
   *  @private
   */
  var isDebugMode_ = true;


  /**
   *  Walk through the domains in the `NAI.PolicyRegistry`, removing all
   *  non-opt-out cookies, and verifying that the opt-out cookies are in
   *  place.  This ensures that we're in a known-good state.
   *
   *  @private
   */
  function revertOptOutCookies() {
    // Helper function to generate a callback function for use in
    // `chrome.cookies.get`.  This is a bit complex, but I can't
    // simply create a closure in the `for` loop, as the variables
    // are evaluated too late.  This way, `policy` is always correct
    // inside the callback, no matter when it executes.
    function generateGetCallback(policy) {
      return function(cookie) {
        var optout = new NAI.Cookie(policy);
        if (cookie === null) {
          NAI.debug(
              '  * Missing Opt-out cookie `%s` for `%s`: Adding',
              policy.name,
              policy.domain);
          optout.set();
        } else if (cookie.name === policy.name &&
            cookie.value !== policy.value) {
          NAI.debug(
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
    NAI.PolicyRegistry.forEach(function(policy, domain) {
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
    var optout = new NAI.Cookie(e.cookie);

    // Assuming that we care about the cookie:
    if (optout.isValid() !== undefined) {
      NAI.debug(
          '* Checking %s cookie `%s` from `%s` (%o)',
          (e.removed ? 'removed' : 'changed/added'),
          e.cookie.name,
          e.cookie.domain,
          e.cookie);
      // If we're _removing_ a _valid_ cookie, add it back:
      if (e.removed && optout.isValid()) {
        NAI.debug(
            '  * Valid opt-out cookie `%s` was removed from `%s`; recreating in 5s',
            e.cookie.name,
            e.cookie.domain);
        if ( optout.isLocked() ) {
          NAI.debug( '    * Nevermind, cookie is currently locked.' );
        } else {
          setTimeout((function (optout) {
            return function () {
              optout.set();
            };
          }(optout)), 5000);
        }
      // Or, if we're _adding_ an _invalid_ cookie, remove it:
      } else if (!e.removed && !optout.isValid()) {
        NAI.debug(
            '  * Non-opt-out cookie `%s` was added to `%s`; removing it.',
            e.cookie.name,
            e.cookie.domain);
        optout.lock();
        optout.remove();
      // Or, if we're adding/updating a valid cookie, clear the mutex
      } else if (!e.removed && optout.isValid()) {
        NAI.debug(
            '  * Valid opt-out cookie `%s` was added to `%s`.',
            e.cookie.name,
            e.cookie.domain);
        optout.unlock();
      }
    } else {
      NAI.debug(
          '  * We don\'t have a policy for `%s`.  Ignoring it.',
          e.cookie.domain);
    }
    optout = null;
  }

  return {
    /**
     *  Initializes opt-out functionality for NAI, reverting opt-out cookies to
     *  a known-good state, and binding to the `chrome.cookies.onChanged` event
     *  to keep things that way.
     *
     *  @name NAI.optout
     *  @requires NAI.Cookie
     *  @requires NAI.PolicyRegistry
     */
    'optout': function() {
      NAI.debug('Initializing NAI Opt-out functionality:');

      NAI.debug('* Binding handlers to `NAIPolicyRegistry`');
      NAI.PolicyRegistry.onload = function() {
        NAI.debug('* `NAIPolicyRegistry` loaded data successfully!');
        NAI.debug('* Binding handler to `chrome.cookies.onChanged`');
        chrome.cookies.onChanged.addListener(changeHandler);
        NAI.debug('* Reverting cookies to known-good state');
        revertOptOutCookies();
      };

      NAI.debug('* Initializing `NAIPolicyRegistry`');
      NAI.PolicyRegistry.init();
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
