define(function(require) {
  var onError = require('./psync/error');
  var Journal = require('./psync/journal');
  var Player = require('./psync/player');
  var config = require('./psync/config');
  var configure = require('./psync/configure');
  var PixyAdapter = require('./psync/adapters/pixy');
  var Persistence = require('./psync/persistence');
  var Optimizer = require('./psync/journal_optimizer');
  var exports;

  exports = {};
  exports.configure = configure;
  exports.Journal = Journal;
  exports.Player = Player;
  exports.onError = onError;
  exports.Persistence = Persistence;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  config.on('change', function(key, newValue, oldValue) {
    if (key === 'enabled' || key === 'adapter') {
      if (config.adapter) {
        if (newValue && !oldValue) {
          config.adapter.install();
        }
        else if (!newValue && oldValue) {
          config.adapter.uninstall();
        }
      }
    }
  });

  return exports;
});