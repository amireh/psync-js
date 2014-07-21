define(function(require) {
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

    if (entry) {
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
