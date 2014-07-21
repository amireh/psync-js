define(function(require) {
  var Sync = require('./pixy/sync');
  var Resolver = require('./pixy/resolver');
  var mkPath = require('psync/path_builder');

  var Adapter = {
    install: function() {
      Sync.install();
    },

    uninstall: function() {
      Sync.restore();
    },

    getShadowId: function(model) {
      return model.cid;
    },

    getId: function(model) {
      return model.get('id');
    },

    getPathFor: function(model) {
      return mkPath(model, Resolver.getConfig, Resolver.getScope);
    },

    serialize: function(model) {
      return model.toPsync();
    }
  };

  return Adapter;
});