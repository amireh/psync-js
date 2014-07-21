define(function(require) {
  var Resolver = require('./resolver');
  var RSVP = require('rsvp');

  var keys = Object.keys;
  var resolveScope = Resolver.resolveScope;
  var resolveScopeFromChain = Resolver.resolveScopeFromChain;
  var resolveCollection = Resolver.resolveCollection;

  /**
   * @class Journal
   *
   * @method traverse
   * @private
   *
   * Traverse the JSON journal construct, and invoke operation-entry handlers
   * for each traversed entry.
   *
   * @param  {Object} records
   *         The JSON journal construct.
   *
   * @param  {Object} callbacks
   *         At least one handler must be specified, the valid handlers are
   *         specified below.
   *
   * @param {Function} [callbacks.postProcess]
   *        A general entry handler that will be called on entries of all operations.
   *
   * @param {Object} [callbacks.postProcess.context]
   *        The scope of the entry.
   *
   * @param {Pixy.Model} [callbacks.postProcess.context.scope]
   *        The scope of the entry.
   *
   * @param {String} [callbacks.postProcess.context.scopeKey]
   *        The scope key.
   *
   * @param {Pixy.Collection} [callbacks.postProcess.context.collection]
   *        The collection of the entry.
   *
   * @param {String} [callbacks.postProcess.context.collectionKey]
   *        The scope collection key.
   *
   * @param {Object} [callbacks.postProcess.context.entry]
   *        The operation entry.
   *
   * @param {String} [callbacks.postProcess.context.opCode]
   *        The operation code.
   *
   * @param {Object} [callbacks.postProcess.result]
   *        The output of the entry processor.
   *
   * @param {Boolean} [callbacks.postProcess.result.success]
   *        Whether the processor has succeeded or not.
   *
   * @param {Mixed} [callbacks.postProcess.result.output]
   *        Whatever the processor has yielded. Or the error in case it failed.
   *
   * @param {Function} [callbacks.create]
   *        A handler that will be called on CREATE entries.
   *
   * @param {Function} [callbacks.update]
   *        A handler that will be called on UPDATE entries.
   *
   * @param {Function} [callbacks.delete]
   *        A handler that will be called on DELETE entries.
   */
  var traverse = function(records, callbacks) {
    var promises = [];

    callbacks = callbacks || {};

    // Scopes:
    //
    // {
    //   "accounts": {
    //   }
    // }
    records.forEach(function(record) {
      var scope, scopeKey, scopeId, scopeInfo;
      var scopeChain = record.path.split('/');
      var collectionKey = scopeChain.pop();
      var collection, operationEntries;

      scopeInfo = resolveScopeFromChain(scopeChain);
      scope = scopeInfo.scope;
      scopeKey = scopeInfo.key;
      scopeId = scopeInfo.id;

      if (!scope) {
        console.warn("Unable to resolve scope at:", record.path);
        return;
      }

      collection = resolveCollection(collectionKey, scope);

      if (!collection) {
        console.warn("Unable to resolve collection at:", record.path);
        return;
      }

      operationEntries = record.operations;

      // Scope instance collection operation entries:
      //
      // {
      //   "accounts": {
      //     "1": {
      //       "transactions": {
      //         "create": [],
      //         "update": [],
      //         "delete": []
      //       }
      //     }
      //   }
      // }
      keys(operationEntries).forEach(function(opCode) {
        var entries = operationEntries[opCode];

        if (!entries.length) {
          return;
        }
        // Skip if there is no generic callback or one for this operation.
        else if (!callbacks.postProcess && !callbacks[opCode]) {
          return;
        }

        // Scope instance collection operation entry:
        //
        // {
        //   "accounts": {
        //     "1": {
        //       "transactions": {
        //         "create": [ "1", "2" ]
        //       }
        //     }
        //   }
        // }
        entries.forEach(function(entry) {
          var svc = RSVP.resolve();
          var postProcessor;

          if (callbacks[opCode]) {
            svc = callbacks[opCode](scope, collection, entry);
            promises.push(svc);
          }

          // Super-crazy code inc:
          //
          // The post-processor will be passed the entire context in order
          // to do whatever it may need to:
          //
          //  - the traversal context
          //  - the processor's status
          //  - the processor's output or error
          //
          // If a post-processor does exist, its output promise will replace
          // that of the processor's as our entry output.
          if (callbacks.postProcess) {
            postProcessor = callbacks.postProcess.bind(null, {
              scope: scope,
              scopeKey: scopeKey,
              collection: collection,
              collectionKey: collectionKey,
              path: record.path,
              entry: entry,
              opCode: opCode
            });

            svc = svc.then(function(result) {
              return postProcessor({ success: true, output: result });
            }, function(error) {
              return postProcessor({ success: false, output: error });
            });

            promises.push(svc);
          }

          svc = undefined;
        });
      });
    });

    return RSVP.all(promises);
  };

  return traverse;
});