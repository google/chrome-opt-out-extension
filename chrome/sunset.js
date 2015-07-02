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
 * Whether to use the accelerated timeline for fast debugging.
 *
 * @type {boolean}
 * @private
 */
Sunset.use_accelerated_timeline_ = false;


/**
 * Offsets of the notifications in days from the starting date.
 *
 * @type {Array<Number>}
 * @private
 */
Sunset.timeline_offsets_ = [
  0,
  13,
  14
];


/**
 * Offsets of the notifications in minutes from the starting time.
 *
 * @type {Array<Number>}
 * @private
 */
Sunset.accelerated_timeline_offsets_ = [
  0,
  3,
  5
];


/**
 * The link to the Chrome Help Center article.
 *
 * @type {String}
 * @private
 */
Sunset.article_url_ = "https://support.google.com/chrome_webstore/answer/6242988?p=keep_my_opt_outs";


/**
 * Determines whether a notification should be shown, based on current state.
 *
 * @param {Date} start The starting date for the deprecation timeline.
 * @param {Date} now The current date.
 * @param {number} index The index of the upcoming notification.
 *
 * return {boolean} True if a notification should be shown.
 */
Sunset.shouldShowNotification_ = function(start, now, index) {
    if (!index || index >= Sunset.timeline_offsets_.length)
      return true;

    var next_scheduled_notification = new Date(start);

    if (Sunset.use_accelerated_timeline_) {
      next_scheduled_notification.setMinutes(
          next_scheduled_notification.getMinutes() + Sunset.accelerated_timeline_offsets_[index]);
    } else {
      next_scheduled_notification.setDate(
          next_scheduled_notification.getDate() + Sunset.timeline_offsets_[index]);
    }

    return now >= next_scheduled_notification;
};


/**
 * Shows a notification if enough time has passed since the beginning
 * of the sunset phase.
 *
 * @private
 */
Sunset.maybeShowNotification_ = function() {
  chrome.storage.local.get(null, function(local_data) {
    // Read the local storage timestamp.
    var local_starting_date = Date.parse(local_data.start) ? new Date(local_data.start) : null;

    chrome.storage.sync.get(null, function(synced_data) {
      // Read the synced storage timestamp.
      var synced_starting_date = Date.parse(synced_data.start) ? new Date(synced_data.start) : null;

      // If the local storage is nonempty, but the sync storage is empty, it means
      // that another synced instance has performed the uninstallation. Uninstall
      // this instance immediately as well.
      if (local_starting_date && !synced_starting_date)
        chrome.management.uninstallSelf();

      // Populate the starting date with today's date if it isn't already set.
      if (!synced_starting_date)
        synced_starting_date = new Date();

      // The date we write to the local storage should be the same as the one
      // in the synced storage.
      local_starting_date = synced_starting_date;

      // Update both storages.
      if (synced_data.start != synced_starting_date.toString())
        chrome.storage.sync.set({ "start": synced_starting_date.toString() });
      if (local_data.start != local_starting_date.toString())
        chrome.storage.local.set({ "start": local_starting_date.toString() });

      // Read the index of the notification to be shown.
      var index = parseInt(synced_data.index, 10);

      // Reset the index if the stored data are invalid or not present.
      if (isNaN(index) || index < 0) {
        index = 0;
      }

      // Trigger notification if we have reached the date suggested
      // by the timeline. This check is not required for the first notification.
      var now = new Date();

      if (Sunset.shouldShowNotification_(synced_starting_date, now, index))
        Sunset.showNotification_(index);
    });
  });
};


/**
 * Shows a notification.
 * @private
 */
Sunset.showNotification_ = function(index) {
  // The second and third notifications have the same text.
  var messageIndex = (index >= 1 ? 1 : 0);

  // Show the notification. We expect the title and text of the notification
  // to be named "title" and "message" respectively, with index as a suffix.
  // The text will contain a link to the corresponding landing page.
  var extensionName = chrome.i18n.getMessage("kmoo");
  chrome.notifications.create(
    index.toString(),
    {
      "type": "basic",
      "iconUrl": "icon128.png",
      "title": extensionName,
      "message": chrome.i18n.getMessage("message" + messageIndex, extensionName),
      "buttons": [{"title": chrome.i18n.getMessage("learnmore")}],
      "priority": 2
    }
  );

  // Save the state.
  chrome.storage.sync.set({
    "index": index + 1
  });

  // Replace the clock with a short-lived alarm that uninstalls
  // the extension a minute after the last notification.
  if (index >= Sunset.timeline_offsets_.length - 1) {
    chrome.alarms.clear("clock", function() {
      chrome.alarms.create("uninstall", {
          "delayInMinutes": 1
      });
    });
  }
}


/**
 * Handles alarms.
 *
 * @param {Alarm} alarm The alarm that fired.
 * @private
 */
Sunset.onAlarm_ = function(alarm) {
  // Consider showing a notification on the regular clock alarm.
  if (alarm.name == "clock")
    Sunset.maybeShowNotification_();

  // Uninstall the extension and show an article on the uninstall delay alarm.
  if (alarm.name == "uninstall") {
    Sunset.showArticle_(function() {
      chrome.management.uninstallSelf();
    });
  }
}


/**
 * Shows a help center article about this extension.
 *
 * @param {Function} [callback] An optional callback function.
 * @private
 */
Sunset.showArticle_ = function(callback) {
  chrome.tabs.create({"url": Sunset.article_url_}, callback);
}


/**
 * Triggers a loop that tests if conditions were met to show the message.
 */
Sunset.run = function() {
  chrome.notifications.onButtonClicked.addListener(function() {
    Sunset.showArticle_();
  });
  chrome.alarms.onAlarm.addListener(Sunset.onAlarm_);

  // Set the interval in which we check the date to twice a day.
  // For the accelerated timeline, check every minute.
  var alarmPeriod = Sunset.use_accelerated_timeline_ ? 1 : 12 * 60;

  chrome.alarms.create("clock", {
      "delayInMinutes": 1,            // In a minute.
      "periodInMinutes": alarmPeriod
  });
}
