define(function(require) {
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

    discardEmptyRecords();
  };

  enabler(optimizeRecords);

  return exports;
});