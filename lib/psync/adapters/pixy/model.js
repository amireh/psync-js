define(function(require) {
  var onError = require('psync/error');
  var Resolver = require('psync/adapters/pixy/resolver');

  var ModelMixin = {
    psync: {
      /**
       * @property {String} key (required)
       *
       * The Psync collection identifier this model resides in. This is what
       * makes fro the last fragment in the journal path.
       *
       * Example:
       *
       *  - "/users/1/accounts" => collectionKey is "accounts"
       *  - "/users/1/accounts/1/transactions" => collectionKey is "transactions"
       */
      collectionKey: undefined,

      /**
       * @property {String|Function} [path=undefined]
       *
       * The absolute journal path to this model's collection. If unspecified,
       * Psync will attempt to infer the path from the @scopeKey, @scopeId, and
       * @collectionKey attributes.
       *
       * If this is a method, it will be called with the Model as the execution
       * context.
       */
      path: undefined,

      /**
       * @property {String} scopeKey
       *
       * Unless @path is defined, and your model belongs to an outer scope,
       * this must point to the JavaScript property where the scope is located.
       *
       * The model's "collection" object will be queried for that property and
       * the scope will be expected to reside there.
       *
       * Example:
       *
       *      this.psync.scopeKey = "user";
       *      var scope = this.collection.user; // must be defined
       */
      scopeKey: undefined,

      /**
       * @property {String|Function} scopeId
       *
       * Explicitly return the ID of the scope, if @scopeKey is set, otherwise
       * Psync will infer the ID from the scope object itself by querying:
       *
       *     scope.get('id')
       *
       */
      scopeId: undefined
    },

    __initialize__: function() {
      if (!this.collection) {
        onError("Psync model must belong to a collection.");
      }
    },

    isJournalled: function() {
      return this.collection && !!Resolver.getConfig(this);
    },

    /**
     * Journal serializer.
     *
     * Defaults to serializing the object to JSON using Pixy.Model#toJSON.
     *
     * @return {Object}
     *         The JSON representation of the object to use when performing
     *         a Psync CREATE operation.
     */
    toPsync: function() {
      var data = this.toJSON();
      delete data.id;
      return data;
    }
  };

  return ModelMixin;
});