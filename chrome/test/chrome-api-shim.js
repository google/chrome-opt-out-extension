var chrome = {};

(function() {
  /* chrome.storage */
  function copy_dict(from, to) {
    for (item in from) {
      if (from.hasOwnProperty(item))
        to[item] = from[item];
    }
  }

  chrome.storage = {};
  function Storage() {
    var storage_ = {};

    this.set = function(dict, callback) {
      copy_dict(dict, storage_);

      if (callback)
        callback();
    };

    this.get = function(keys, callback) {
      // We don't use keys anywhere.
      var result = {};
      copy_dict(storage_, result);
      if (callback)
        callback(result);
    }
  };
  chrome.storage.sync = new Storage();
  chrome.storage.local = new Storage();

  /* chrome.alarms */
  var alarms_ = {};

  chrome.alarms = {
    "create": function(name, params, callback) {
      alarms_[name] = params;
      if (callback)
        callback(alarms_[name]);
    },

    "get": function(name, callback) {
      if (callback)
        callback(alarms_[name]);
    },

   "clear": function(name, callback) {
      delete alarms_[name];
      if (callback)
        callback();
    }
  };

  /* chrome.i18n */
  chrome.i18n = {};
  chrome.i18n.getMessage = function() { return ""; };

  /* chrome.notifications */
  chrome.notifications = {};
  chrome.notifications.create = function() {};

  /* chrome.management */
  var uninstalled_ = false;

  chrome.management = {};
  chrome.management.uninstallSelf = function() {
    uninstalled_ = true;
  };

  /* chrome.testUtils */
  /* Our test utils - not a real Chrome API */
  chrome.testUtils = {};
  chrome.testUtils.wasUninstalled = function() {
    return uninstalled_;
  }
})();
