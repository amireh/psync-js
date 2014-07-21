define(function(require) {
  var config = require('psync/config');

  return function mkCreateEntry(model) {
    var adapter = config.adapter;
    var entry = {
      id: adapter.getShadowId(model),
      data: adapter.serialize(model, 'create')
    };

    return entry;
  };
});