define(function(require) {
  var Sync = require('./pixy/sync');
  var Resolver = require('./pixy/resolver');
  var mkPath = require('psync/path_builder');
  var ModelMixin = require('./pixy/model');
  var PlayerResolver = require('psync/player/resolver');

  var Adapter = {
    ModelMixin: ModelMixin,

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

    getResourceAt: function(path, id) {
      var absolutePath;

      if (arguments.length === 1) {
        absolutePath = path;
      }
      else {
        absolutePath = [ path, id ].join('/');
      }

      return PlayerResolver.resolveResource(absolutePath);
    },

    serialize: function(model, opCode) {
      return model.toPsync(opCode === 'update');
    }
  };

  return Adapter;
});