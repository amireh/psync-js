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

  config.enabled = true;

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

  config.optimized = true;
  config.optimizer = {
    /**
     * @cfg {Boolean} discardEmptyRecords
     *
     * This optimization will remove all records that have no operation entries
     * anymore (either due to other optimization effects, or because of normal
     * removals).
     */
    discardEmptyRecords: true,

    /**
     * @cfg {Boolean} discardDeleted
     *
     * This optimization will discard CREATE and UPDATE entries for resources
     * that have been deleted (e.g, have a DELETE entry).
     *
     * This optimizer deals with two cases:
     *
     * == Case 1: Shadow resources
     *
     * If the resource being deleted is a shadow one, then *all* entries for
     * that resource are discarded.
     *
     * == Case 2: Persistent resources
     *
     * Since a persistent resource can only have UPDATE entries, then only those
     * will be discarded by this optimizer.
     */
    discardDeleted: true,

    /**
     * @cfg {Boolean} singleUpdates
     *
     * This optimization will not allow duplicate UPDATE entries for the same
     * resource. Instead, it will keep the latest entry and discard the rest.
     */
    singleUpdates: true,

    /**
     * @cfg {Boolean} mungeUpdates
     *
     * This optimization will merge UPDATE entries for a shadow resource that is
     * just being created (e.g, has a CREATE entry) so that the CREATE entry
     * reflects the latest local version of the resource.
     *
     * Be aware that this uses lodash _.merge() to merge the data.
     */
    mungeUpdates: true
  };

  extend(beacon, Evented);

  config.trigger = beacon.trigger.bind(beacon);
  config.on = beacon.on.bind(beacon);
  config.off = beacon.off.bind(beacon);

  return config;
});
define('psync/util/wrap',[],function() {
  /** @internal Array wrap. */
  return function wrap(item) {
    return item ? Array.isArray(item) ? item : [ item ] : [];
  };
});

define('psync/util/remove_by_value',[],function() {
  /** @internal Remove a record. */
  return function removeByvalue(record, set) {
    var index;

    if (set) {
      index = set.indexOf(record);

      if (index !== -1) {
        set.splice(index, 1);

        return true;
      }
    }
  };
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
define('psync/journal/length_of_record',['require','psync/util/wrap'],function(require) {
  var wrap = require('psync/util/wrap');
  var keys = Object.keys;

  /** @internal Get the number of operation entries in a record. */
  var lengthOf = function(record) {
    return keys(record.operations).reduce(function(count, opcode) {
      return count += wrap(record.operations[opcode]).length;
    }, 0);
  };

  return lengthOf;
});
define('psync/journal',['require','lodash','psync/config','psync/util/evented','psync/util/wrap','psync/util/remove_by_value','./journal/processors/create','./journal/processors/update','./journal/processors/delete','./journal/length_of_record'],function(require) {
  var _ = require('lodash');
  var config = require('psync/config');
  var Evented = require('psync/util/evented');
  var wrap = require('psync/util/wrap');
  var removeByValue = require('psync/util/remove_by_value');
  var createProcessor = require('./journal/processors/create');
  var updateProcessor = require('./journal/processors/update');
  var deleteProcessor = require('./journal/processors/delete');
  var lengthOf = require('./journal/length_of_record');
  var extend = _.extend;
  var findWhere = _.findWhere;
  var keys = Object.keys;
  var journal;


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

  var Journal = function() {
    this.records = [];
    return this;
  };

  var onChange = function() {
    // internal event, don't hook into this!
    journal.trigger('preprocess');

    // hook into this one instead
    journal.trigger('change');
  };

  extend(Journal.prototype, Evented, {
    /**
     * Log an operation on a model to the journal.
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
        entry.timestamp = Date.now();
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

      return this.removeEntry(record, opcode, entry);
    },

    removeEntry: function(record, opcode, entry) {
      if (record && record.operations && entry) {
        // if (removeByValue(entry, record.operations[opcode])) {
        //   onChange();

        //   return true;
        // }
      }
    },

    discardProcessed: function(records) {
      records.forEach(function(record) {
        keys(record.operations).forEach(function(opcode) {
          var entries = record.operations[opcode];
          entries.forEach(function(entry) {
            var resourceId;

            switch(opcode) {
              case 'create':
                resourceId = entry.shadow_id;
              break;

              case 'update':
              case 'delete':
                resourceId = entry.id;
              break;
            }

          });
        });
      });
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

    getRecords: function() {
      return this.records;
    },

    getEntries: function(path, opcode) {
      var record = this.get(path);

      if (record) {
        return wrap(record.operations[opcode]);
      }
    },

    toJSON: function() {
      return { records: this.records };
    },

    /**
     * @private
     *
     * Used by modules like the persistence layer to broadcast manual/direct
     * changes to the journal.
     */
    emitChange: function() {
      onChange();
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

  /**
   * @class Player
   *
   * An implementation of the Psync recording player. The player provides the
   * ability to re-play a journal, committing the "processed" records, and
   * rolling back "dropped" ones.
   *
   * The player provides an evented interface for consuming playback events.
   *
   * === Resource-based events
   *
   * For each entry that gets played back, an event will be emitted by the
   * Player with the id of the resource path.
   *
   * For example, to listen to playbacks of the "create" operation on Article
   * resources (whenever an Article is created by the Player):
   *
   *     Player.on('articles:create', function(resourceId, context) {
   *     });
   *
   * The available events are: "create", "update", and "delete".
   *
   * === The generic "change" event
   *
   * If you're interested in generic-processing of playback events, you can
   * listen to the "change" event and use the event parameters to locate the
   * resource.
   *
   * Example:
   *
   *     Player.on('change', function(resourceId, context) {
   *       var resourcePath = context.path;
   *
   *       // lookup the resource using resourceId + resourcePath
   *       var resource;
   *
   *       // ...
   *     });
   *
   * === Synopsis of the playback event
   *
   * @param {String} event.resourceId
   *        The ID of the resource that was operated on.
   *
   * @param {Object} event.context
   *        The player context at the time the entry was played out.
   *
   * @param {String} event.context.path
   *        The Psync path of the resource.
   *
   * @param {Boolean} event.context.rollingBack
   *        True if this was a roll-back playback, e.g, from a "dropped" record.
   *
   * @param {Boolean} event.context.selfOrigin
   *        The value you provided to Player#play(). See the method's docs
   *        for more on this parameter.
   */
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
define('psync/configure',['require','./config','./error'],function(require) {
  var config = require('./config');
  var onError = require('./error');
  var previousValues = {};

  var configure = function(key, value) {
    var oldValue;

    if (!config.hasOwnProperty(key)) {
      return onError("Unknown Psync configuration property '" + key + "'");
    }

    oldValue = config[key];

    if (value !== undefined) {
      previousValues[key] = config[key];

      config[key] = value;
      config.trigger('change', key, value, previousValues[key]);
    }

    return oldValue;
  };

  configure.restore = function(key) {
    configure(key, previousValues[key]);
  };

  return configure;
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

  var load = exports.load = function() {
    var serializedJournal = localStorage.getItem('journal');
    var data;

    if (serializedJournal) {
      data = JSON.parse(serializedJournal);

      journal.records = data.records || [];
      journal.emitChange();

      return true;
    }
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
define('psync/journal_optimizer/config',['require','psync/config','psync/journal'],function(require) {
  var config = require('psync/config');
  var journal = require('psync/journal');
  var enabled;
  var runner;

  var enable = function() {
    if (enabled) {
      return;
    }

    journal.on('preprocess', runner);
    enabled = true;
  };

  var disable = function() {
    if (!enabled) {
      return;
    }

    journal.off('preprocess', runner);
    enabled = false;
  };

  config.on('change', function() {
    if (config.optimized) {
      enable();
    }
    else {
      disable();
    }
  });

  return function(_runner) {
    runner = _runner;

    if (config.optimized) {
      enable();
    }
  };
});
define('psync/journal_optimizer',['require','psync/config','psync/journal','psync/journal/length_of_record','psync/util/wrap','psync/util/remove_by_value','./journal_optimizer/config','lodash'],function(require) {
  var config = require('psync/config');
  var journal = require('psync/journal');
  var lengthOf = require('psync/journal/length_of_record');
  var wrap = require('psync/util/wrap');
  var removeByValue = require('psync/util/remove_by_value');
  var enabler = require('./journal_optimizer/config');
  var _ = require('lodash');
  var exports = {};
  var uniq = _.uniq;
  var where = _.where;
  var findWhere = _.findWhere;
  var merge = _.merge;
  var sortBy = _.sortBy;
  var mapBy = _.map;

  /**
   * Pick the latest UPDATE entry for every resource, and discard older ones.
   *
   * @internal
   * @impure Side-effects on:
   *
   *  - record.operations.update
   */
  var discardOldUpdates = function(record) {
    var entries = record.operations.update;
    var ids = entries.map(function(entry) {
      return entry.id;
    });

    record.operations.update = uniq(ids).map(function(id) {
      var resourceEntries = where(entries, { id: id });

      if (resourceEntries.length === 1) {
        return resourceEntries[0];
      }

      resourceEntries = sortBy(resourceEntries, 'timestamp');

      return resourceEntries[resourceEntries.length-1];
    });
  };

  /**
   * For every resource that has a CREATE entry, locate an UPDATE entry,
   * merge its data with the CREATE one, then discard it.
   *
   * @internal
   * @impure Side-effects on:
   *
   *   - record.operations.update
   *   - record.operations.create
   */
  var mungeUpdates = function(record) {
    mapBy(record.operations.update, 'id').forEach(function(id) {
      var updates = record.operations.update;
      var createEntry = findWhere(record.operations.create, { id: id });
      var updateEntry;

      if (createEntry) {
        updateEntry = findWhere(record.operations.update, { id: id });
        merge(createEntry.data, updateEntry.data);
        removeByValue(updateEntry, updates);
      }
    });
  };

  /**
   * Remove empty records.
   *
   * @internal
   * @impure Side-effects on:
   *
   *  - journal.records
   */
  var discardEmptyRecords = function() {
    var paths = journal.records.map(function(record) {
      return record.path;
    });

    paths.forEach(function(path) {
      var record = findWhere(journal.records, { path: path });

      if (record && !lengthOf(record)) {
        removeByValue(record, journal.records);
      }
    });
  };

  /**
   * Discard CREATE or UPDATE entries for resources that have been deleted.
   *
   * @internal
   * @impure Side effects on:
   *
   *  - record.operations.create
   *  - record.operations.update
   */
  var discardDeletedEntries = function(record) {
    var otherOpcodes = [ 'create', 'update' ];
    var removeEntry = function(entries, id) {
      var entry = findWhere(entries, { id: id });

      if (!entry) {
        return;
      }

      removeByValue(entry, entries);

      return removeEntry(entries, id);
    };

    record.operations['delete'].forEach(function(deleteEntry) {
      otherOpcodes.forEach(function(opcode) {
        var entries = where(record.operations[opcode], { id: deleteEntry.id });

        if (entries.length) {
          removeEntry(record.operations[opcode], deleteEntry.id);
        }
      });
    });
  };

  var optimizeRecords = function() {
    journal.getRecords().forEach(function(record) {
      var hasDeletes, hasCreates, hasUpdates;

      if (config.optimizer.discardDeleted) {
        hasDeletes = wrap(record.operations.delete).length;

        if (hasDeletes) {
          discardDeletedEntries(record);
        }
      }

      hasUpdates = wrap(record.operations.update).length;

      if (hasUpdates) {
        if (config.optimizer.singleUpdates) {
          discardOldUpdates(record);
        }

        hasCreates = wrap(record.operations.create).length;

        if (config.optimizer.mungeUpdates && hasCreates) {
          mungeUpdates(record);
        }
      }
    });

    if (config.optimizer.discardEmptyRecords) {
      discardEmptyRecords();
    }
  };

  enabler(optimizeRecords);

  return exports;
});
define('psync',['require','./psync/error','./psync/journal','./psync/player','./psync/config','./psync/configure','./psync/adapters/pixy','./psync/persistence','./psync/journal_optimizer'],function(require) {
  var onError = require('./psync/error');
  var Journal = require('./psync/journal');
  var Player = require('./psync/player');
  var config = require('./psync/config');
  var configure = require('./psync/configure');
  var PixyAdapter = require('./psync/adapters/pixy');
  var Persistence = require('./psync/persistence');
  var Optimizer = require('./psync/journal_optimizer');
  var exports;

  exports = {};
  exports.configure = configure;
  exports.Journal = Journal;
  exports.Player = Player;
  exports.onError = onError;
  exports.Persistence = Persistence;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  config.on('change', function(key, newValue, oldValue) {
    if (key === 'enabled' || key === 'adapter') {
      if (config.adapter) {
        if (newValue && !oldValue) {
          config.adapter.install();
        }
        else if (!newValue && oldValue) {
          config.adapter.uninstall();
        }
      }
    }
  });

  return exports;
});
