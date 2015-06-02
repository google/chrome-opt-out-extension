// Copyright 2015 Google Inc.
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
 * @fileoverview This file contains the deprecation mechanism for this
 * extension.
 */


/**
 * A singleton class responsible for showing the deprecation notifications
 * and uninstalling this extension.
 */
var Sunset = {};


/**
 * The hard deadline date of the deprecation phase.
 *
 * @type {Date}
 * @private
 */
Sunset.deadline_ = new Date();  // TBD


/**
 * The maximum number of days when the extension can be running before
 * it is automatically uninstalled.
 *
 * @type {Number}
 * @private
 */
Sunset.max_uptime_ = 30;


/**
 * The link to the Chrome Help Center article.
 * TODO(msramek): Link to the exact topic page when the article is written.
 *
 * @type {String}
 * @private
 */
Sunset.article_url_ = "https://support.google.com/chrome";


/**
 * Shows a help center article about this extension.
 * @private
 */
Sunset.showArticle_ = function() {
  chrome.tabs.create({"url": Sunset.article_url_});

  // Change the warning icon to a normal one.
  chrome.browserAction.setIcon({"path": {
      "19": "action19.png",
      "38": "action38.png"
  }});
}


/**
 * Runs periodically to check if the extension has been running for another
 * day. If so, it decreases the TTL. When TTL reaches zero, the extension
 * is automatically uninstalled.
 * @private
 */
Sunset.heartbeat_ = function() {
  // If we're past the hard deadline, just uninstall the extension.
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today >= Sunset.deadline_) {
    chrome.management.uninstallSelf();
    return;
  }

  // Otherwise, check if a whole day has passed and decrease the TTL.
  chrome.storage.sync.get(null, function(data) {
    // Read the remaining TTL and last uptime date from the storage.
    var ttl = parseInt(data.ttl, 10);
    var last_date = new Date(data.date);

    if (isNaN(ttl) || ttl >= Sunset.max_uptime_)
      ttl = Sunset.max_uptime_;

    if (!last_date.getTime())
      last_date = new Date();

    // If a day has passed, decrease the TTL. When TTL reaches zero,
    // uninstall the extension.
    last_date.setHours(0, 0, 0, 0);
    if (today > last_date)
      --ttl;

    if (ttl <= 0) {
      chrome.management.uninstallSelf();
      return;
    }

    // Write the new TTL and date.
    chrome.storage.sync.set({
      "ttl": ttl,
      "date": today.toString()
    });
  });
}


/**
 * Triggers a loop that tests if conditions were met to show the message.
 */
Sunset.run = function() {
  chrome.browserAction.onClicked.addListener(Sunset.showArticle_);
  chrome.notifications.onButtonClicked.addListener(Sunset.showLandingPage_);
  chrome.alarms.onAlarm.addListener(Sunset.heartbeat_);
  chrome.alarms.create(null, {
      "delayInMinutes": 1,        // In a minute.
      "periodInMinutes": 12 * 60  // Twice per day.
  });
}

