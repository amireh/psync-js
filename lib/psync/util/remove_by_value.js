define(function() {
  /** @internal Remove a record. */
  return function removeByvalue(record, set) {
    var index;

    index = set.indexOf(record);

    if (index !== -1) {
      set.splice(index, 1);
    }
  };
});