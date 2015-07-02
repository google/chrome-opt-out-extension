test(function () {
  assert_equals(Sunset.timeline_offsets_.length, 3);
  assert_equals(Sunset.timeline_offsets_[0], 0);
  assert_equals(Sunset.timeline_offsets_[1], 13);
  assert_equals(Sunset.timeline_offsets_[2], 14);
}, "Sanity-check the offsets.");

function incrementDate(d) {
  var tmp = new Date(d);
  tmp.setDate(tmp.getDate() + 1);
  return tmp;
}

test(function () {
  // Just installed:
  var start = new Date("2015-06-01 12:00 GMT");
  assert_true(Sunset.shouldShowNotification_(start, start, 0));

  // Subsequent Days:
  var current = new Date("2015-06-01 12:01 GMT");
  for (var i = 1; i < 100; i++) {
    current = incrementDate(current);
    assert_true(Sunset.shouldShowNotification_(start, current, 0));
    assert_equals(i >= Sunset.timeline_offsets_[1], Sunset.shouldShowNotification_(start, current, 1));
    assert_equals(i >= Sunset.timeline_offsets_[2], Sunset.shouldShowNotification_(start, current, 2));
    assert_true(Sunset.shouldShowNotification_(start, current, 3));
  }
}, "Sanity-check shouldShowNotification_");

test(function () {
  var start = new Date("2015-06-01 12:00 GMT");

  var before = new Date(start);
  before.setSeconds(before.getSeconds() - 1);
  assert_false(Sunset.shouldShowNotification_(start, before, 1));


  // Increment to exactly the next transition point:
  var current = new Date(start);
  for (var i = 0; i < Sunset.timeline_offsets_[1]; i++)
    current = incrementDate(current);

  assert_true(Sunset.shouldShowNotification_(start, current, 1));

  current.setSeconds(current.getSeconds() - 1);
  assert_false(Sunset.shouldShowNotification_(start, current, 1));
}, "Edge-cases for shouldShowNotification_");

test(function () {
  var reached = 0;
  var limit = 100;

  var test_index = function(index) {
    // The last notification should uninstall the extension. This means that
    // if maybeShowNotification is called with index greater or equal than
    // the number of notifications, something has gone wrong during
    // the uninstallation. We should attempt to show the last notification
    // and uninstall again.
    chrome.storage.sync.set({ "index": index }, function() {
      Sunset.maybeShowNotification_();

      // The index should be increased.
      chrome.storage.sync.get(null, function(data) {
        assert_equals(data.index, index + 1);

        // The uninstallation alarm should be set to 1 minute.
        chrome.alarms.get("uninstall", function(alarm) {
          assert_equals(alarm.delayInMinutes, 1);

          // Clear the alarm and test the next index.
          chrome.alarms.clear("uninstall", function() {
            reached = index;
            if (index < limit)
              test_index(index + 1);
          });
        });
      });
    });
  };

  // Test the indices greater or equal to the number of notifications.
  test_index(Sunset.timeline_offsets_.length);
  assert_equals(reached, limit);
}, "maybeShowNotification_ always works for large indices");

test(function () {
  // Try different configurations of local and storage data.
  for (var local = 0; local <= 1; local++)
    for (var synced = 0; synced <= 1; synced++) {
      local_data = !!local ? { "start": (new Date()).toString() } : {};
      synced_data = !!synced ? { "start": (new Date()).toString() } : {};

      chrome.testUtils.reinstall();

      chrome.storage.local.clear(function() {
        chrome.storage.sync.clear(function() {
          chrome.storage.local.set(local_data, function() {
            chrome.storage.sync.set(synced_data, function() {
              Sunset.maybeShowNotification_();
            });
          });
        });
      });

      // When local storage is non-empty and the synced storage is empty,
      // the extension should uninstall itself. Otherwise, it must remain
      // installed.
      assert_equals(chrome.testUtils.wasUninstalled(), !!local && !synced);

      // The starting dates in the local storage and synced storage should
      // be always the same.
      if (!chrome.testUtils.wasUninstalled()) {
        chrome.storage.local.get(function(local_data) {
          chrome.storage.synced.set(function(synced_data) {
            assert_equals(local_data.start, synced_data.start);
          });
        });
      }
    }
}, "Local storage and synced storage relations");
