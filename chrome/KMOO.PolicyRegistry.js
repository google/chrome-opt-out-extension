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
 * @fileoverview This file contains the 'KMOO.PolicyRegistry' class, which
 * presents an interface to the opt-out registry information. It must be
 * loaded after KMOO.js, as it depends on KMOO's existence.
 *
 * @author mkwst@google.com (Mike West)
 */

/**
 * Singleton that holds the KMOO opt-out registry information, and offers
 * accessor methods to obtain data for a particular domain.
 *
 * Data is loaded asynchronously, so code relying on the registry being
 * loaded ought bind a handler to the object's `onload` and `onerror`
 * events.
 */
KMOO.PolicyRegistry = {};

/**
 * Wed, 01 Jan 2031 00:00:00 GMT in Unix epoch time. We'll use this for
 * cookie expiry dates.
 *
 * @type {number}
 * @const
 */
KMOO.PolicyRegistry.FAR_FUTURE_EXPIRY = 1924992000;

/**
 * Opt-out cookie data for KMOO participants, implemented as a hash: keys
 * are the cookie domains, values are objects containing cookie data (or
 * `null`, if the partner hasn't implemented an opt-out cookie).
 *
 * @type {!Object}
 * @private
 */
KMOO.PolicyRegistry.registry_ = {'byDomain': {}};


/**
 * Load the cookie data for KMOO participants from the `registry.json`
 * file packaged up with the extension. This file ought be regularly
 * updated from http://networkadvertising.org/optoutprotector/registry.json
 *
 * @private
 */
KMOO.PolicyRegistry.loadDomainPolicyRegistry_ = function() {
  var req = new XMLHttpRequest();

  req.open('GET', '/registry.json', true);
  req.onreadystatechange = function(e) {
    if (req.readyState === 4 && (req.status === 200 || req.status === 0)) {
      var temp = JSON.parse(req.responseText);
      if (!temp.registry) {
        KMOO.PolicyRegistry.onerror(
            "JSON doesn't contain a `registry` attribute. Error, error!");
      }
      for (var i = temp.registry.length - 1; i >= 0; i--) {
        var el = temp.registry[i];

        if (el.host === 'host' && el.name === 'name') {
          // Ignore the non-cookie demo data which NAI has for some reason
          // included in their registry.
          continue;
        }

        // Normalize the data to Chrome's extension API values.
        // Domains start with `.`.
        if (el.host[0] !== '.')
          el.host = '.' + el.host;
        el.domain = el.host;
        el.url = 'http://' + el.host.substr(1) + el.path;
        el.expirationDate = KMOO.PolicyRegistry.FAR_FUTURE_EXPIRY;
        delete el.company;
        delete el.host;

        if (!KMOO.PolicyRegistry.registry_.byDomain[el.domain]) {
          // Add the cookie data to the policy registry.
          KMOO.PolicyRegistry.registry_.byDomain[el.domain] = [];
        }
        KMOO.PolicyRegistry.registry_.byDomain[el.domain].push(el);
      }

      // After processing all the data, trigger the onload "event".
      KMOO.PolicyRegistry.onload();
      req = null;
    }
  };
  req.send(null);
};


/**
 * The function bound to `onload` is called when the registry data is
 * successfully parsed and loaded.
 */
KMOO.PolicyRegistry.onload = function() {};


/**
 * The function bound to `onerror` is called when the registry data
 * can't be loaded for some reason. An error message is passed in as
 * a parameter.
 *
 * @param {string} msg The error message.
 */
KMOO.PolicyRegistry.onerror = function(msg) {};

/**
 * Retrieves domain data for a this object's cookie. Domains are matched
 * such that requesting a domain policy for `www.doubleclick.net` will
 * return the stored policy for `.doubleclick.net`.
 *
 * @param {string} domain The domain to lookup.
 * @return {Object|undefined} The policy data, or `undefined` if no
 *     policy exists for a given domain.
 */
KMOO.PolicyRegistry.getDomainPolicy = function(domain) {
  var value = undefined;

  // Normalize domains to begin with '.'.
  if (domain[0] !== '.') {
    domain = '.' + domain;
  }
  while (domain) {
    var temp = KMOO.PolicyRegistry.registry_.byDomain[domain];
    if (temp) {
      return temp;
    }

    if (domain[0] === '.') {
      // In `loadDomainPolicyRegistry_`, we verify that every entry in the
      // registry begins with `.`. So, strip the first block off `domain`
      // (or, if `domain` starts with a `.`, strip it, then the first
      // block) and try again.
      domain = domain.substr(1);
    }

    if (domain.indexOf('.') !== -1) {
      domain = domain.substr(domain.indexOf('.'));
    } else {
      domain = false;
    }
  }

  // If we fell through, return `undefined`.
  return undefined;
};

/**
 * Loops through the items in `registry_.byDomain`, calling `callback` on
 * each, just like `forEach` would on an array.
 *
 * @param {function} callback Function to be called for each domain.
 */
KMOO.PolicyRegistry.forEach = function(callback) {
  for (var domain in KMOO.PolicyRegistry.registry_.byDomain) {
    if (KMOO.PolicyRegistry.registry_.byDomain.hasOwnProperty(domain)) {
      callback(KMOO.PolicyRegistry.registry_.byDomain[domain], domain);
    }
  }
};

/**
 * Initialize the PolicyRegistry, asynchronously. Bind handlers to the
 * `onload` and `onerror` events to be notified of load status.
 */
KMOO.PolicyRegistry.init = function() {
  KMOO.PolicyRegistry.loadDomainPolicyRegistry_();
};
