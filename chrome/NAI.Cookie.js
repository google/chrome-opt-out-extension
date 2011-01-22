// Copyright 2011 Google Inc. All rights reserved.
/**
 *  This class wraps the Chrome `Cookie` object with a few helper methods
 *  and mutexes that are necessary because the Cookie API is annoyingly
 *  deficient in a few areas.  All cookie operations (set or delete)
 *  should go through this class.
 *
 *  @param {Cookie} c The Chrome `Cookie` object to wrap.
 *  @constructor
 *  @author mkwst@google.com (Mike West)
 */
NAI.Cookie = function(c) {
  /**
   *  The wrapped `Cookie`
   *  @type {Cookie}
   *  @private
   */
  this.cookie_ = c;
  /**
   *  Cached result of call to `isValid`; see definition of "validity" there
   *
   *  @type {boolean}
   *  @private
   */
  this.validity_ = null;
};

/**
 *  Adding or modifying a cookie generates two events: one for the cookie's
 *  deletion (!!!), one for it's addition.  This makes no sense, and since
 *  I'm attempting to take specific action on deletion (namely, adding the
 *  cookie back), I need some sort of locking mechanism here.  I'm storing
 *  cookies I set here in this object, and ask clients of this library to
 *  call `setSuccessfully` on a cookie once the addition event comes
 *  through.  This is a stunningly annoying hack.
 *
 *  Filed as http://code.google.com/p/chromium/issues/detail?id=70101
 *
 *  @type {object}
 *  @private
 */
NAI.Cookie.mutexes_ = {};

/**
 * Determines whether a cookie is "valid" (that is, whether it's an opt-out
 * cookie for a domain we do care about).  Cookies for domains without
 * explicit policies always return `undefined`.
 *
 * @return {boolean|undefined}  True if it's a valid cookie, False if it's
 *                              an invalid cookie, undefined if it's a cookie
 *                              for a domain we don't care about.
 */
NAI.Cookie.prototype.isValid = function() {
  // Result is memoized, so check `this.validity_` first:
  if (this.validity_ === null) {
    var policy = NAI.PolicyRegistry.getDomainPolicy(this.cookie_.domain);

    // Assume that the cookie's invalid, then run checks:
    this.validity_ = false;

    // If the cookie is in a domain we care about, do some checks:
    if (policy) {
      // Loop through the policies for this domain
      for (var i = policy.length - 1; i >= 0; i--) {
        // If the cookie has the `name` and `value` associated with
        // any of the domain policies, it's valid
        if (this.cookie_.name === policy[i].name &&
            this.cookie_.value === policy[i].value) {
          this.validity_ = true;
        }
      }
    // Cookies for domains without an explicit policy return `undefined`
    } else {
      this.validity_ = undefined;
    }
  }
  return this.validity_;
};

/**
 *  Set a browser cookie using this object's wrapped `Cookie` data
 */
NAI.Cookie.prototype.set = function() {
  var policy = NAI.PolicyRegistry.getDomainPolicy(this.cookie_.domain),
      this_  = this;
  for (var i = policy.length - 1; i >= 0; i--) {
    if (!this.isLocked()) {
      // If the cookie isn't locked, request it.  If we find a cookie that's
      // already been set with the same domain, name, and value, don't
      // overwrite it.  Otherwise we'll get into an exciting infinite loop.
      chrome.cookies.get(
        {
          'url': policy[i].url,
          'name': policy[i].name
        },
        // Create a callback function with the current value of `policy[i]`
        // locked in.  This is a bit ugly.
        (function (currentPolicy) {
          return function (gotten) {
            if (gotten === null || gotten.value !== currentPolicy.value) {
              this_.lock();
              chrome.cookies.set(currentPolicy);
            }
          };
        }(policy[i]))
      );
    } else {
      NAI.debug('`%s` for `%s` is being set, exiting.', policy[i].name, policy[i].domain  );
    }
  }
};

/**
 *  Is the cookie locked?
 *
 *  @return {Boolean} True if the cookie's locked, false otherwise.
 */
NAI.Cookie.prototype.isLocked = function() {
  var mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  return !!NAI.Cookie.mutexes_[mutex];
}

/**
 *  Lock a cookie for writing.  _MUST_ be called before writing to a cookie.
 *  VERY VERY IMPORTANT.  
 *
 *  Also, this is a massive hack and ugly ugly ugly.  Hate it.
 *
 *  @param {object} policy If `policy` is passed in, it is used for the lock
 *                         rather than `this.cookie_`.  I know, I know...
 */
NAI.Cookie.prototype.lock = function(policy) {
  var mutex;
  if ( policy ) {
     mutex = 'name:' + policy.name + 'domain:' + policy.domain;
  } else {
     mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  }
  NAI.debug("- Locking %s", mutex);
  NAI.Cookie.mutexes_[mutex] = 1;
};

/**
 *  Clear the mutex for a cookie.  _MUST_ be called in response to an
 *  `onChanged` event with `removed` set to false.  VERY VERY IMPORTANT. :)
 */
NAI.Cookie.prototype.unlock = function() {
  var mutex = 'name:' + this.cookie_.name + 'domain:' + this.cookie_.domain;
  NAI.debug("- Unlocking %s", mutex);
  delete(NAI.Cookie.mutexes_[mutex]);
};

/**
 *  Removes a browser cookie matching this object's wrapped `Cookie` data
 */
NAI.Cookie.prototype.remove = function() {
  chrome.cookies.remove({
    'url': 'http://' + this.cookie_.domain + this.cookie_.path,
    'name': this.cookie_.name
  });
};
