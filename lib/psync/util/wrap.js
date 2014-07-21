define(function() {
  /** @internal Array wrap. */
  return function wrap(item) {
    return item ? Array.isArray(item) ? item : [ item ] : [];
  };
});
