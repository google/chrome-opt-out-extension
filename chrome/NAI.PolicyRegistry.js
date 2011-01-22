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
 *  Singleton that holds the NAI opt-out registry information, and offers
 *  accessor methods to obtain data for a particular domain.
 *
 *  Data is loaded asynchronously, so code relying on the registry being
 *  loaded ought bind a handler to the object's `onload` and `onerror`
 *  events.
 *
 *  @name NAI.PolicyRegistry
 *  @namespace
 *  @author mkwst@google.com (Mike West)
 */
NAI.PolicyRegistry = (function() {
  /**
   *  Opt-out cookie data for NAI participants, implemented as a hash: keys
   *  are the cookie domains, values are objects containing cookie data (or
   *  `null`, if the partner hasn't implemented an opt-out cookie).
   *
   *  @type {Object}
   *  @private
   */
  var registry_ = {
    'byDomain': {}
  };

  /**
   *
   *  Load the cookie data for NAI participants from the `registry.json`
   *  file packaged up with the extension.  This file ought be regularly
   *  updated from http://networkadvertising.org/optoutprotector/registry.json
   *
   *  @private
   */
  function loadDomainPolicyRegistry_() {
    var req = new XMLHttpRequest();
    req.open('GET', './registry.json', true);
    req.onreadystatechange = function(e) {
      if (req.readyState === 4 && (req.status === 200 || req.status === 0)) {
        var temp = JSON.parse(req.responseText);
        if (!temp.registry) {
          NAI.PolicyRegistry.onerror(
              "JSON doesn't contain a `registry` attribute.  Error, error!");
        }
        for (var i = temp.registry.length - 1; i >= 0; i--) {
          var el = temp.registry[i];

          // Ignore the non-cookie demo data (hate this):
          if (el.host === 'host' && el.name === 'name') {
            continue;
          }
          // Normalize to Chrome's extension API values
          el['url'] = 'http://' + el.host + el.path;
          el['domain'] = el.host;
          // Domains start with `.`
          if (el['domain'][0] !== '.') {
            el['domain'] = '.' + el['domain'];
          }
          el['expirationDate'] = 1924992000;
          delete(el['company']);
          delete(el['host']);
          if (!registry_.byDomain[el.domain]) {
            registry_.byDomain[el.domain] = [];
          }
          registry_.byDomain[el.domain].push(el);
        }
        NAI.PolicyRegistry.onload();
        req = null;
      }
    }
    req.send(null);
  }

  return {
    /**
     *  The function bound to `onload` is called when the registry data is
     *  successfully parsed and loaded.
     *
     *  @event
     *  @name NAI.PolicyRegistry.onload
     */
    'onload': function() {},

    /**
     *  The function bound to `onerror` is called when the registry data
     *  can't be loaded for some reason.  An error message is passed in as
     *  a parameter.
     *
     *  @event
     *  @name NAI.PolicyRegistry.onerror
     *  @param {String} msg The error message.
     */
    'onerror': function() {},

    /**
     *  Retrieves domain data for a this object's cookie.  Domains are matched
     *  such that requesting a domain policy for `www.doubleclick.net` will
     *  return the stored policy for `.doubleclick.net`.
     *
     *  @function
     *  @name NAI.PolicyRegistry.getDomainPolicy
     *  @return {Object|undefined}  The policy data, or `undefined` if no
     *                              policy exists for a given domain.
     */
    'getDomainPolicy': function getDomainPolicy(domain) {
      var value = undefined;
      // Normalize everything to begin with '.'
      if (domain[0] !== '.') {
        domain = '.' + domain;
      }
      while (domain) {
        var temp = registry_.byDomain[domain];
        if (temp) {
          return temp;
        } else {
          // In `loadDomainPolicyRegistry_`, we verify that every entry in the
          // registry begins with `.`.  So, strip the first block off `domain`
          // (or, if `domain` starts with a `.`, strip it, then the first
          // block) and try again.
          if (domain[0] === '.') {
            domain = domain.substr(1);
          }
          if (domain.indexOf('.') !== -1) {
            domain = domain.substr(domain.indexOf('.'));
          } else {
            domain = false;
          }
        }
      }
      // If we fell through, return `undefined`.
      return undefined;
    },

    /**
     *  Loops through the items in `registry_.byDomain`, calling `callback` on
     *  each, just like `forEach` would on an array.
     *
     *  @function
     *  @name NAI.PolicyRegistry.forEach
     *  @param  {function}  callback Function to be called for each domain.
     */
    'forEach': function(callback) {
      for (domain in registry_.byDomain) {
        if (registry_.byDomain.hasOwnProperty(domain)) {
          callback(registry_.byDomain[domain], domain);
        }
      }
    },

    /**
     *  Initialize the PolicyRegistry, asynchronously.  Bind handlers to the
     *  `onload` and `onerror` events to be notified of load status.
     *
     *  @function
     *  @name NAI.PolicyRegistry.init
     */
    'init': function() {
      loadDomainPolicyRegistry_();
    }
  };
}());
