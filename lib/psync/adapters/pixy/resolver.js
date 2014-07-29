define(function(require) {
  var _ = require('lodash');
  var result = _.result;
  var exports;

  var getConfig = function(model) {
    if (model.psync) {
      return result(model, 'psync', model);
    }
    else if (model.collection) {
      return result(model.collection, 'psync', model.collection);
    }
  };

  var getScope = function(model, scopeKey) {
    if (model[scopeKey]) {
      return result(model, scopeKey, model);
    }
    else if (model.collection) {
      return result(model.collection, scopeKey, model.collection);
    }
  };

  var getResource = function(path, id, rootScope) {

  };

  exports = {};
  exports.getScope = getScope;
  exports.getConfig = getConfig;
  exports.getResource = getResource;

  return exports;
});