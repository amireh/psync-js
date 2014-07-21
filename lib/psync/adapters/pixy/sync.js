define(function(require) {
  var Pixy = require('pixy');
  var _ = require('lodash');
  var journal = require('psync/journal');

  var result = _.result;
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
  var journalledSync = function(method, model/*, options*/) {
    var svc, opcode, entry;
    var isJournalled = result(model, 'isJournalled', model);

    if (isJournalled) {
      opcode = opcodeMap[method];
      console.log("Model is journalled.");

      if (opcode) {
        entry = journal.add(opcode, model);
      }
      else {
        console.debug("Operation '" + method + "' is not supported, skipping.");
      }
    }

    svc = sync.apply(this, arguments);

    // Remove the entry if the operation was committed successfully.
    svc.then(function(rc) {
      journal.remove(opcode, model, entry);
    });

    return svc;
  };

  // Take over Pixy.Sync.
  journalledSync.install = function() {
    Pixy.sync = journalledSync;
  };

  // Restore the original Pixy.Sync, without the journaling behavior.
  journalledSync.restore = function() {
    Pixy.sync = sync;
  };

  return journalledSync;
});
