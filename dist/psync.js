define('psync/error',[],function() {
  var onError, lastHandler, exports;

  onError = function(error) {
    if (typeof error === 'string') {
      throw new Error(error);
    } else {
      throw error;
    }
  };

  exports = function() {
    return onError.apply(this, arguments);
  };

  exports.configure = function(errorHandler) {
    lastHandler = onError;
    onError = errorHandler;
  };

  exports.restore = function() {
    onError = lastHandler;
    lastHandler = undefined;
  };

  return exports;
});
define('psync/util/evented',['require','pixy/mixins/events'],function(require) {
  var EventedMixin = require('pixy/mixins/events');

  return EventedMixin;
});
define('psync/config',['require','lodash','./util/evented'],function(require) {
  var _ = require('lodash');
  var Evented = require('./util/evented');
  var extend = _.extend;
  var config = {};
  var beacon = (function() { return this; })();

  /**
   * @cfg {Psync.Adapter} adapter
   *
   * The framework adapter to use.
   */
  config.adapter = null;

  /**
   * @cfg {Number[]} unrecoverableResponseCodes
   *
   * A set of HTTP status codes for which journal entries should be discarded.
   */
  config.unrecoverableResponseCodes = [ 422, 400 ];

  /**
   * @cfg {Boolean} persistent
   *
   * Whether Psync should maintain a version of the Journal in localStorage.
   */
  config.persistent = true;

  /**
   * @cfg {Object} rootScope
   *
   * A collection that should be used as the outer-most scope from which to
   * begin resolving paths. For example, this could be your Users collection if
   * all your journaled resources are nested under/accessible via user models.
   */
  config.rootScope = undefined;

  config.debug = false;

  extend(beacon, Evented);

  config.trigger = beacon.trigger.bind(beacon);
  config.on = beacon.on.bind(beacon);
  config.off = beacon.off.bind(beacon);

  return config;
});
define('psync/journal/processors/create',['require','psync/config'],function(require) {
  var config = require('psync/config');

  return function mkCreateEntry(model) {
    var adapter = config.adapter;
    var entry = {
      id: adapter.getShadowId(model),
      data: adapter.serialize(model, 'create')
    };

    return entry;
  };
});
define('psync/journal/processors/update',['require','psync/config'],function(require) {
  var config = require('psync/config');

  return function mkUpdateEntry(model) {
    var adapter = config.adapter;
    var id = adapter.getId(model);

    if (id) {
      return {
        id: id,
        data: adapter.serialize(model, 'update')
      };
    }
  };
});
define('psync/journal/processors/delete',['require','psync/config'],function(require) {
  var config = require('psync/config');

  return function mkDeleteEntry(model) {
    var adapter = config.adapter;
    var id = adapter.getId(model);

    if (id) {
      return {
        id: id
      };
    }
  };
});
define('psync/journal',['require','lodash','psync/config','psync/util/evented','./journal/processors/create','./journal/processors/update','./journal/processors/delete'],function(require) {
  var _ = require('lodash');
  var config = require('psync/config');
  var Evented = require('psync/util/evented');
  var createProcessor = require('./journal/processors/create');
  var updateProcessor = require('./journal/processors/update');
  var deleteProcessor = require('./journal/processors/delete');
  var extend = _.extend;
  var findWhere = _.findWhere;
  var keys = Object.keys;
  var journal;

  /** @internal Array wrap. */
  var wrap = function(item) {
    return item ? Array.isArray(item) ? item : [ item ] : [];
  };

  var getRecord = function(path, set) {
    return findWhere(set, { path: path });
  };

  var createRecord = function(path, set) {
    var record = { path: path, operations: {} };
    set.push(record);
    return record;
  };

  /** @internal Append an operation entry to a record. */
  var append = function(record, opcode, entry) {
    record.operations[opcode] = record.operations[opcode] || [];
    record.operations[opcode].push(entry);
  };

  /** @internal Remove an operation entry from a record. */
  var removeEntry = function(record, opcode, entry) {
    var entries = record.operations[opcode];
    var index;

    if (entries) {
      index = entries.indexOf(entry);

      if (index !== -1) {
        entries.splice(index, 1);

        return true;
      }
    }
  };

  /** @internal Remove a record. */
  var remove = function(record, set) {
    var index;

    index = set.indexOf(record);

    if (index !== -1) {
      set.splice(index, 1);
    }
  };

  /** @internal Get the number of operation entries in a record. */
  var lengthOf = function(record) {
    return keys(record.operations).reduce(function(count, opcode) {
      return count += wrap(record.operations[opcode]).length;
    }, 0);
  };

  var Journal = function() {
    this.records = [];
    return this;
  };

  var onChange = function() {
    journal.trigger('change');
  };

  extend(Journal.prototype, Evented, {
    /**
     * Add an operation entry on a given model to the journal, e.g, journal
     * the model operation.
     *
     * @param {"create"|"update"|"delete"} opcode
     *        The operation code.
     *
     * @param {Object} model
     *        The model being operated on. Must be "journalable", or
     *        recognizable by the PathResolver.
     *
     * @return {Object}
     *         The journal entry for the model operation. You can keep track of
     *         this if you decide to cancel/undo/remove this from the journal.
     */
    add: function(opcode, model) {
      var set = this.records;
      var path = config.adapter.getPathFor(model);
      var record = getRecord(path, set) || createRecord(path, set);
      var entry;

      switch(opcode) {
        case 'create':
          entry = createProcessor(model);
        break;
        case 'update':
          entry = updateProcessor(model);
        break;
        case 'delete':
          entry = deleteProcessor(model);
        break;
      }

      if (entry) {
        append(record, opcode, entry);
        onChange();
      }

      return entry;
    },

    /**
     * Remove an entry from the journal.
     *
     * @param  {"create"|"update"|"delete"} opcode
     * @param  {Object} model
     * @param  {Object} entry
     *         The entry that was created for this model in #add.
     *
     * @return {Boolean}
     *         True if the entry was found and was removed.
     */
    remove: function(opcode, model, entry) {
      var path = config.adapter.getPathFor(model);
      var record = getRecord(path, this.records);

      if (record) {
        if (removeEntry(record, opcode, entry)) {
          if (!lengthOf(record)) {
            remove(record, this.records);
          }

          onChange();

          return true;
        }
      }
    },

    clear: function() {
      if (!this.isEmpty()) {
        this.records = [];
        onChange();
      }
    },

    isEmpty: function() {
      return this.length === 0;
    },

    get: function(path) {
      return getRecord(path, this.records);
    },

    getEntries: function(path, opcode) {
      var record = this.get(path);

      if (record) {
        return wrap(record.operations[opcode]);
      }
    },

    toJSON: function() {
      return { records: this.records };
    }
  });

  Object.defineProperty(Journal.prototype, 'length', {
    get: function() {
      return this.records.reduce(function(sum, record) {
        return sum += lengthOf(record);
      }, 0);
    }
  });

  journal = new Journal();

  return journal;
});
/* jshint -W098 */
define('psync/player/resolver',['require','inflection','../error','psync/config'],function(require) {
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
define('psync/player/traverse',['require','./resolver','rsvp'],function(require) {
  var Resolver = require('./resolver');
  var RSVP = require('rsvp');

  var keys = Object.keys;
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
define('psync/player',['require','pixy','rsvp','./player/traverse'],function(require) {
  var Pixy = require('pixy');
  var RSVP = require('rsvp');
  var traverse = require('./player/traverse');
  var Emitter = new Pixy.Object();
  var all = RSVP.all;
  var MODE_PLAYBACK = 'playbackMode';
  var MODE_ROLLBACK = 'rollbackMode';
  var mode, wasItMe;
  var singleton;

  // Add the resource to our local collection and pull it from the API.
  //
  // NO-OP if the resource could not be fetched.
  //
  // Yields the model id.
  var onCreate = function(scope, collection, data) {
    var model;
    var resourceId = data.id;

    resourceId = ''+resourceId;
    model = collection.get(resourceId);

    if (!model) {
      model = collection.push({ id: resourceId });

      return model.fetch().then(function() {
        return model.get('id');
      }, function(error) {
        // rollback our change:
        collection.remove(resourceId);
        return error;
      });
    }
    else {
      return RSVP.resolve(resourceId);
    }
  };

  // Pull the new version of the resource.
  //
  // Yields the model id.
  var onUpdate = function(scope, collection, data) {
    var resourceId = ''+data.id;
    var model = collection.get(resourceId);

    if (model) {
      if (mode === MODE_PLAYBACK && wasItMe) {
        return RSVP.resolve(resourceId);
      }

      return model.fetch().then(function() {
        return model.get('id');
      });
    }
    else {
      return onCreate(scope, collection, data);
    }
  };

  // Remove the resource from our local collection.
  //
  // Yields the model id.
  var onDelete = function(scope, collection, data) {
    var resourceId = ''+data.id;
    var model = collection.get(resourceId);

    if (model) {
      collection.remove(model);
    }

    return RSVP.resolve(resourceId);
  };

  // Provide a hook for external modules like stores to react to the changes
  // we've just played back.
  //
  // Each operation will yield the affected resource id.
  var broadcastEntryDone = function(context, result) {
    var opCode;

    if (result.success) {
      opCode = context.opCode;

      if (mode === MODE_ROLLBACK) {
        switch(context.opCode) {
          case 'create':
            opCode = 'delete';
          break;

          case 'delete':
            opCode = 'create';
          break;

          case 'update':
            opCode = 'update';
          break;
        }
      }

      [ context.collectionKey + ':' + opCode, 'change' ].forEach(function(event) {
        Emitter.trigger(event, result.output, {
          path: context.path,
          rollingBack: mode === MODE_ROLLBACK,
          selfOrigin: !!wasItMe
        });
      });
    }
  };

  var Player = function() {
    return this;
  };

  Player.prototype.play = function(journal, selfOrigin) {
    var svc;

    wasItMe = selfOrigin;

    svc = [];

    if (journal.processed) {
      mode = MODE_PLAYBACK;

      svc.concat([
        traverse(journal.processed || [], {
          postProcess: broadcastEntryDone,
          create: onCreate,
          update: onUpdate,
          delete: onDelete,
        })
      ]);
    }

    if (journal.dropped && selfOrigin) {
      mode = MODE_ROLLBACK;

      svc.concat([
        traverse(journal.dropped || [], {
          postProcess: broadcastEntryDone,
          create: onDelete,
          update: onUpdate,
          delete: onCreate,
        })
      ]);
    }

    return all(svc);
  };

  [ 'on', 'off' ].forEach(function(hook) {
    Player.prototype[hook] = Emitter[hook].bind(Emitter);
  });

  singleton = new Player();

  return singleton;
});
define('psync/adapters/pixy/sync',['require','pixy','lodash','psync/journal','psync/config'],function(require) {
  var Pixy = require('pixy');
  var _ = require('lodash');
  var journal = require('psync/journal');
  var config = require('psync/config');

  var result = _.result;
  var contains = _.contains;
  var sync = Pixy.sync;
  var opcodeMap = {
    'create': 'create',
    'update': 'update',
    'patch':  'update',
    'delete': 'delete'
  };

  /**
   * A journaling-aware version of Pixy.sync.
   *
   * The operation will be recorded in the journal before it is committed. If
   * it gets committed successfully, the journal entry will be removed.
   *
   * @param  {String} method
   * @param  {Pixy.Model} model
   *
   * @return {RSVP.Promise}
   *         What Pixy.sync returns.
   */
  var journaledSync = function(method, model/*, options*/) {
    var svc, opcode, entry;
    var isJournalled = result(model, 'isJournalled', model);

    if (isJournalled) {
      opcode = opcodeMap[method];

      if (opcode) {
        entry = journal.add(opcode, model);
      }
    }

    svc = sync.apply(this, arguments);

    if (entry && !config.debug) {
      // Discard the entry if the operation was committed successfully:
      svc.then(function() {
        journal.remove(opcode, model, entry);
      });

      // Discard the entry on things like Bad Request.
      //
      // See config.unrecoverableResponseCodes
      svc.then(null, function(xhrError) {
        xhrError = xhrError || {};

        if (contains(config.unrecoverableResponseCodes, xhrError.status)) {
          journal.remove(opcode, model, entry);
        }
      });
    }

    return svc;
  };

  // Take over Pixy.Sync.
  journaledSync.install = function() {
    Pixy.sync = journaledSync;
  };

  // Restore the original Pixy.Sync, without the journaling behavior.
  journaledSync.restore = function() {
    Pixy.sync = sync;
  };

  return journaledSync;
});

define('psync/adapters/pixy/resolver',['require','lodash'],function(require) {
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

  exports = {};
  exports.getScope = getScope;
  exports.getConfig = getConfig;

  return exports;
});
define('psync/path_builder',['require','lodash','psync/error'],function(require) {
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

  var mkPath = function(model, getConfig, getScope) {
    var path = [];
    var config = getConfig(model);
    var scopeKey, scope;

    if (!config.path && !config.collectionKey) {
      return onError("Model must configure either @psync.path or @psync.collectionKey.");
    }
    else if (config.path) {
      return result(config, 'path', model);
    }
    else {
      // try to infer it from the scope
      scopeKey = config.scopeKey;

      if (scopeKey) {
        scope = getScope(model, scopeKey);

        if (!scope) {
          return onError("Expected model scope to be found at `this.collection." + scopeKey + "`.");
        }

        path.unshift(scope.get('id'));
        path.unshift(mkPath(scope, getConfig, getScope));
      }
    }

    path.push(config.collectionKey);

    return normalizePath(path.join('/'));
  };

  return mkPath;
});
define('psync/adapters/pixy/model',['require','psync/error','psync/adapters/pixy/resolver'],function(require) {
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
define('psync/adapters/pixy',['require','./pixy/sync','./pixy/resolver','psync/path_builder','./pixy/model'],function(require) {
  var Sync = require('./pixy/sync');
  var Resolver = require('./pixy/resolver');
  var mkPath = require('psync/path_builder');
  var ModelMixin = require('./pixy/model');

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

    serialize: function(model, opCode) {
      return model.toPsync(opCode === 'update');
    }
  };

  return Adapter;
});
define('psync/persistence',['require','psync/config','psync/journal'],function(require) {
  var config = require('psync/config');
  var journal = require('psync/journal');
  var exports = {};
  var enabled;

  var updateCache = function() {
    if (journal.isEmpty()) {
      localStorage.removeItem('journal');
    }
    else {
      localStorage.setItem('journal', JSON.stringify(journal.toJSON()));
    }
  };

  var enable = exports.enable = function() {
    if (enabled) {
      return;
    }

    journal.on('change', updateCache);
    enabled = true;
  };

  var disable = exports.disable = function() {
    if (!enabled) {
      return;
    }

    journal.off('change', updateCache);
    enabled = false;
  };

  config.on('change', function() {
    if (config.persistent) {
      enable();
    }
    else {
      disable();
    }
  });

  return exports;
});
define('psync',['require','./psync/error','./psync/journal','./psync/player','./psync/config','./psync/adapters/pixy','./psync/persistence'],function(require) {
  var onError = require('./psync/error');
  var Journal = require('./psync/journal');
  var Player = require('./psync/player');
  var config = require('./psync/config');
  var PixyAdapter = require('./psync/adapters/pixy');
  var Persistence = require('./psync/persistence');
  var exports;

  exports = {};
  exports.Journal = Journal;
  exports.Player = Player;
  exports.onError = onError;
  exports.Persistence = Persistence;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  exports.configure = function(key, value) {
    var oldValue;

    if (!config.hasOwnProperty(key)) {
      return onError("Unknown Psync configuration property '" + key + "'");
    }

    oldValue = config[key];

    if (value !== undefined) {
      config[key] = value;
      config.trigger('change');
    }

    return oldValue;
  };

  return exports;
});
