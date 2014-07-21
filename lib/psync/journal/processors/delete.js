define(function(require) {
  var config = require('psync/config');

  return function mkDeleteEntry(model) {
    var adapter = config.adapter;
    var id = adapter.getId(model);

    if (id) {
      return {
        id: id
      };
    }
  };
});