define(function(require) {
  var config = require('psync/config');
  var journal = require('psync/journal');
  var exports = {};
  var enabled;

  var updateCache = function() {
    if (journal.isEmpty()) {
      localStorage.removeItem('journal');
    }
    else {
      localStorage.setItem('journal', JSON.stringify(journal.toJSON()));
    }
  };

  var enable = exports.enable = function() {
    if (enabled) {
      return;
    }

    journal.on('change', updateCache);
    enabled = true;
  };

  var disable = exports.disable = function() {
    if (!enabled) {
      return;
    }

    journal.off('change', updateCache);
    enabled = false;
  };

  config.on('change', function() {
    if (config.persistent) {
      enable();
    }
    else {
      disable();
    }
  });

  return exports;
});