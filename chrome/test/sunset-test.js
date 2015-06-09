test(function () {
  assert_equals(Sunset.timeline_offsets_.length, 2);
  assert_equals(Sunset.timeline_offsets_[0], 0);
  assert_equals(Sunset.timeline_offsets_[1], 14);
}, "Sanity-check the offsets.");
