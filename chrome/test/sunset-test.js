test(function () {
  assert_equals(Sunset.timeline_offsets_.length, 3);
  assert_equals(Sunset.timeline_offsets_[0], 0);
  assert_equals(Sunset.timeline_offsets_[1], 14);
  assert_equals(Sunset.timeline_offsets_[2], 15);
}, "Sanity-check the offsets.");

function incrementDate(d) {
  var tmp = new Date(d);
  tmp.setDate(tmp.getDate() + 1);
  return tmp;
}

test(function () {
  // Just installed:
  var start = new Date("2015-06-01 12:00 GMT");
  assert_true(Sunset.shouldShowNotification_(start, start, new Date(null), 0));
  assert_true(Sunset.shouldShowNotification_(start, start, start, 0));

  // Subsequent Days:
  var current = new Date("2015-06-01 12:01 GMT");
  for (var i = 1; i < 100; i++) {
    current = incrementDate(current);
    assert_true(Sunset.shouldShowNotification_(start, current, start, 0));
    assert_equals(i >= Sunset.timeline_offsets_[1], Sunset.shouldShowNotification_(start, current, start, 1));
    assert_equals(i >= Sunset.timeline_offsets_[2], Sunset.shouldShowNotification_(start, current, start, 2));
    assert_true(Sunset.shouldShowNotification_(start, current, start, 3));
  }
}, "Sanity-check shouldShowNotification_");

test(function () {
  var start = new Date("2015-06-01 12:00 GMT");

  var before = new Date(start);
  before.setSeconds(before.getSeconds() - 1);
  assert_false(Sunset.shouldShowNotification_(start, before, start, 1));


  // Increment to exactly the next transition point:
  var current = new Date(start);
  for (var i = 0; i < Sunset.timeline_offsets_[1]; i++)
    current = incrementDate(current);

  assert_true(Sunset.shouldShowNotification_(start, current, start, 1));

  current.setSeconds(current.getSeconds() - 1);
  assert_false(Sunset.shouldShowNotification_(start, current, start, 1));
}, "Edge-cases for shouldShowNotification_");
