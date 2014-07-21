define(function(require) {
  var onError = require('./psync/error');
  var journal = require('./psync/journal');
  var config = require('./psync/config');
  var PixyAdapter = require('./psync/adapters/pixy');
  var exports;

  exports = {};
  exports.journal = journal;
  exports.onError = onError;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  exports.configure = function(key, value) {
    if (!config.hasOwnProperty(key)) {
      return onError("Unknown Psync configuration property '" + key + "'");
    }

    if (value) {
      config[key] = value;
    }

    return config[key];
  };

  return exports;
});