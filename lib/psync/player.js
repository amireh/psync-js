define(function(require) {
  var Pixy = require('pixy');
  var RSVP = require('rsvp');
  var traverse = require('./player/traverse');
  var Emitter = new Pixy.Object();
  var all = RSVP.all;
  var MODE_PLAYBACK = 'playbackMode';
  var MODE_ROLLBACK = 'rollbackMode';
  var mode, wasItMe;

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

      Emitter.trigger(context.collectionKey + ':' + opCode, result.output);
    }
  };

  var Player = function(journal, selfOrigin) {
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
    Player[hook] = Emitter[hook].bind(Emitter);
  });

  return Player;
});