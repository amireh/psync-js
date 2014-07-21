define(function(require) {
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