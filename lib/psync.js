define(function(require) {
  var Pixy = require('pixy');
  var _ = require('lodash');
  var RSVP = require('rsvp');
  var PixyAdapter = require('./psync/pixy_adapter');
  var onError = require('./psync/error');
  var exports;

  exports = {};

  exports.onError = onError;
  exports.Adapters = {
    Pixy: PixyAdapter
  };

  return exports;
});