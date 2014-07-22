define(function(require) {
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