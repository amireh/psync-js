define(function(require) {
  var config = require('./config');
  var onError = require('./error');
  var previousValues = {};

  var configure = function(key, value) {
    var oldValue;

    if (!config.hasOwnProperty(key)) {
      return onError("Unknown Psync configuration property '" + key + "'");
    }

    oldValue = config[key];

    if (value !== undefined) {
      previousValues[key] = config[key];

      config[key] = value;
      config.trigger('change', key, value, previousValues[key]);
    }

    return oldValue;
  };

  configure.restore = function(key) {
    configure(key, previousValues[key]);
  };

  return configure;
});