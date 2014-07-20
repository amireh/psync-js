define(function(require) {
  var _ = require('lodash');
  var onError = require('psync/error');
  var result = _.result;

  // Make sure the path starts with a single trailing slash:
  var normalizePath = function(path) {
    if (path[0] !== '/') {
      return '/' + path;
    }
    else {
      return path.replace(/^\/+/, '/');
    }
  };

  var mkPath = function(getConfig, getScope) {
    var path = [];
    var config = getConfig(this);
    var scopeKey, scope;

    if (!config.path && !config.collectionKey) {
      return onError("Model must configure either @psync.path or @psync.collectionKey.");
    }
    else if (config.path) {
      return result(config, 'path', this);
    }
    else {
      // try to infer it from the scope
      scopeKey = config.scopeKey;

      if (scopeKey) {
        scope = getScope(this, scopeKey);

        if (!scope) {
          return onError("Expected model scope to be found at `this.collection." + scopeKey + "`.");
        }

        path.unshift(scope.get('id'));
        path.unshift(mkPath.call(scope, getConfig, getScope));
      }
    }

    path.push(config.collectionKey);

    return normalizePath(path.join('/'));
  };

  return mkPath;
});