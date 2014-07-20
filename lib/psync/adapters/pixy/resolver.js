define(function(require) {
  var _ = require('lodash');
  var result = _.result;
  var exports;

  var getConfig = function(model) {
    return result(model, 'psync', model) ||
      result(model.collection, 'psync', model.collection);
  };

  var getScope = function(model, scopeKey) {
    return model.collection[scopeKey];
  };

  exports = {};
  exports.getScope = getScope;
  exports.getConfig = getConfig;

  return exports;
});