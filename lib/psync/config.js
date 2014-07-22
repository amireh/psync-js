define(function(require) {
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