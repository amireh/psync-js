define(function(require) {
  var onError = require('./psync/error');
  var journal = require('./psync/journal');
  var config = require('./psync/config');
  var PixyAdapter = require('./psync/adapters/pixy');
  var Persistence = require('./psync/persistence');
  var exports;

  exports = {};
  exports.journal = journal;
  exports.onError = onError;
  exports.Persistence = Persistence;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  exports.configure = function(key, value) {
    var oldValue;

    if (!config.hasOwnProperty(key)) {
      return onError("Unknown Psync configuration property '" + key + "'");
    }

    oldValue = config[key];

    if (value !== undefined) {
      config[key] = value;
      config.trigger('change');
    }

    return oldValue;
  };

  return exports;
});