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
 * Whether to replace days with minutes for fast debugging.
 *
 * @type {boolean}
 * @private
 */
Sunset.acceleratedTimeline_ = false;


/**
 * Offsets of the notifications in days from the starting date.
 *
 * @type {Array<Number>}
 * @private
 */
Sunset.timeline_offsets_ = [
  0,
  14,
  15
];


/**
 * The link to the Chrome Help Center article.
 *
 * @type {String}
 * @private
 */
Sunset.article_url_ = "https://support.google.com/chrome_webstore/?p=keep_my_opt_out";


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

    if (Sunset.acceleratedTimeline_) {
      next_scheduled_notification.setMinutes(
          next_scheduled_notification.getMinutes() + Sunset.timeline_offsets_[index]);
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
  chrome.storage.sync.get(null, function(data) {
    // Populate the starting date with today's date if it isn't already set.
    var starting_date = Date.parse(data.start) ? new Date(data.start) : new Date();
    if (data.start != starting_date.toString())
      chrome.storage.sync.set({ "start": starting_date.toString() });

    // Read the index of the notification to be shown.
    var index = parseInt(data.index, 10);

    // Reset the index if the stored data are invalid or not present.
    if (isNaN(index) || index < 0 ||
        index >= Sunset.timeline_offsets_.length) {
      index = 0;
    }

    // Trigger notification if we have reached the date suggested
    // by the timeline. This check is not required for the first notification.
    var now = new Date();

    if (Sunset.shouldShowNotification_(starting_date, now, index))
      Sunset.showNotification_(index);
  });
};


/**
 * Shows a notification.
 * @private
 */
Sunset.showNotification_ = function(index) {
  // There is no 4th notification. Instead, we just uninstall the extension.
  if (index >= Sunset.timeline_offsets_.length - 1)
    chrome.management.uninstallSelf();

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
      "message": chrome.i18n.getMessage("message" + index, extensionName),
      "buttons": [{"title": chrome.i18n.getMessage("learnmore")}],
    }
  );

  // Save the state.
  chrome.storage.sync.set({
    "index": index + 1
  });
}


/**
 * Shows a help center article about this extension.
 * @private
 */
Sunset.showArticle_ = function() {
  chrome.tabs.create({"url": Sunset.article_url_});
}


/**
 * Triggers a loop that tests if conditions were met to show the message.
 */
Sunset.run = function() {
  chrome.notifications.onButtonClicked.addListener(Sunset.showArticle_);
  chrome.alarms.onAlarm.addListener(Sunset.maybeShowNotification_);

  // Set the interval in which we check the date to twice a day.
  // For the accelerated timeline, check every minute.
  var alarmPeriod = Sunset.acceleratedTimeline_ ? 1 : 12 * 60;

  chrome.alarms.create(null, {
      "delayInMinutes": 1,            // In a minute.
      "periodInMinutes": alarmPeriod
  });
}
