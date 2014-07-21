define(function(require) {
  var InflectionJS = require('inflection');
  var onError = require('../error');
  var config = require('psync/config');
  var exports = {};

  var normalizeKey = function(key) {
    return key.underscore().pluralize().camelize(true);
  };

  /**
   * Given a scope name and an id, try to locate the resource.
   *
   * @param  {String} scopeKey
   *         The scope's collection name, like "accounts", or "users".
   *
   * @param  {String} scopeId
   *         Id of the resource within that scope.
   *
   * @return {Pixy.Model}
   *         The scope if resolved, undefined otherwise.
   */
  var resolveScope = function(scopeKey, scopeId, container) {
    var collection, scope;
    var outerScope = container || config.rootScope;

    if (!outerScope) {
      return onError("You must either pass a container or set one in Psync.config.rootScope.");
    }

    collection = outerScope[normalizeKey(scopeKey)];

    if (!collection) {
      console.error('Unknown scope "' + scopeKey + '"');
      return;
    }

    scope = collection.get(''+scopeId);

    if (!scope) {
      console.error('Unable to resolve scope "' + scopeKey + '" with id:', scopeId);
    }

    return scope;
  };

  var resolveCollection = function(collectionName, scope) {
    return scope[normalizeKey(collectionName)];
  };

  var resolveScopeFromChain = function(inChain) {
    var cursor, scopeKey, scopeId;
    var i;
    var scopeChain = [].concat(inChain);

    if (scopeChain[0] === '') {
      scopeChain.shift();
    }

    for (i = 0; i < scopeChain.length; ++i) {
      scopeKey = scopeChain[i];
      scopeId = scopeChain[++i];

      cursor = resolveScope(scopeKey, scopeId, cursor);
    }

    return {
      scope: cursor,
      key: scopeKey,
      id: scopeId
    };
  };

  exports.resolveScope = resolveScope;
  exports.resolveScopeFromChain = resolveScopeFromChain;
  exports.resolveCollection = resolveCollection;

  return exports;
});