define(function(require) {
  var Pixy = require('pixy');
  var sync = Pixy.sync;

  var journalledSync = function() {
    return sync.apply(this, arguments);
  };

  var Adapter = {
    install: function() {
      Pixy.sync = journalledSync;
    },

    uninstall: function() {
      Pixy.sync = sync;
    }
  };

  return Adapter;
});