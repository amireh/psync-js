define(function(require) {
  var config = require('psync/config');
  var journal = require('psync/journal');
  var enabled;
  var runner;

  var enable = function() {
    if (enabled) {
      return;
    }

    journal.on('preprocess', runner);
    enabled = true;
  };

  var disable = function() {
    if (!enabled) {
      return;
    }

    journal.off('preprocess', runner);
    enabled = false;
  };

  config.on('change', function() {
    if (config.optimized) {
      enable();
    }
    else {
      disable();
    }
  });

  return function(_runner) {
    runner = _runner;

    if (config.optimized) {
      enable();
    }
  };
});