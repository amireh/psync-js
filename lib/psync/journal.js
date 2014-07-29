define(function(require) {
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
     * @emit change
     *       If the entry was found and was removed.
     *
     * @return {Boolean}
     *         True if the entry was found and was removed.
     */
    remove: function(opcode, model, entry) {
      var path = config.adapter.getPathFor(model);
      var record = getRecord(path, this.records);

      if (record && record.operations && entry) {
        if (removeByValue(entry, record.operations[opcode])) {
          onChange();

          return true;
        }
      }
    },

    removeAt: function(absolutePath, opcode) {
      var id, path, record, entry;
      var fragments = absolutePath.split('/');

      id = fragments.pop();
      path = fragments.join('/');
      record = this.get(path);

      if (record && record.operations) {
        entry = findWhere(record.operations[opcode], { id: id });

        if (entry) {
          if (removeByValue(entry, record.operations[opcode])) {
            onChange();

            return true;
          }
        }
      }
    },

    /**
     * Discard local entries that are referenced in a given set of records. This
     * can be used to discard entries that were successfully processed after
     * a COMMIT operation.
     *
     * @param  {Object[]} records
     *         The set of processed journal records.
     *
     * @emit change
     *       If at least one entry was found and was discarded.
     *
     * @return {Number}
     *         The number of entries that were discarded.
     */
    discardProcessed: function(records) {
      var getEntries = this.getEntries.bind(this);
      var discarded = 0;
      var OPCODE_RESOURCE_ID = {
        create: 'shadow_id',
        update: 'id',
        delete: 'id'
      };

      records.forEach(function(record) {
        keys(record.operations).forEach(function(opcode) {
          var entries = record.operations[opcode];
          var localEntries = getEntries(record.path, opcode);

          entries.forEach(function(entry) {
            var resourceId = entry[OPCODE_RESOURCE_ID[opcode]];
            var localEntry;

            localEntry = findWhere(localEntries, { id: resourceId });

            if (localEntry) {
              removeByValue(localEntry, localEntries);
              ++discarded;
            }
          });
        });
      });

      if (discarded > 0) {
        onChange();
      }

      return discarded;
    },

    /**
     * Clear the journal. Remove all records.
     *
     * @emit change
     */
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

    /**
     * Serialize the Journal to a JSON construct that conforms to the Psync
     * commit input specification.
     *
     * @return {Object}
     *         A JSON object you can use to commit the journal.
     */
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
    },

    /**
     * @internal
     * Directly replace the journal records.
     */
    _overwrite: function(dump) {
      this.records = dump.records || [];
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
