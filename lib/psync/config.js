define(function(require) {
  var _ = require('lodash');
  var Evented = require('./util/evented');
  var extend = _.extend;
  var config = {};

  var beacon = new (function() { return this; })();

  extend(beacon, Evented);

  config.adapter = null;

  /**
   * @cfg {Number[]} unrecoverableResponseCodes
   *
   * A set of HTTP status codes for which journal entries should be discarded.
   */
  config.unrecoverableResponseCodes = [ 422, 400 ];

  config.persistent = true;

  config.trigger = beacon.trigger.bind(beacon);
  config.on = beacon.on.bind(beacon);
  config.off = beacon.off.bind(beacon);

  return config;
});