define(function(require) {
  var config = require('psync/config');

  return function mkUpdateEntry(model) {
    var adapter = config.adapter;
    var id = adapter.getId(model);

    if (id) {
      return {
        id: id,
        data: adapter.serialize(model, 'update')
      };
    }
  };
});