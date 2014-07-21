define(function(require) {
  var wrap = require('psync/util/wrap');
  var keys = Object.keys;

  /** @internal Get the number of operation entries in a record. */
  var lengthOf = function(record) {
    return keys(record.operations).reduce(function(count, opcode) {
      return count += wrap(record.operations[opcode]).length;
    }, 0);
  };

  return lengthOf;
});