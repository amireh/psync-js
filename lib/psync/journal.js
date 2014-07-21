define(function(require) {
  var _ = require('lodash');
  var config = require('psync/config');
  var Evented = require('psync/util/evented');
  var createProcessor = require('./journal/processors/create');
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