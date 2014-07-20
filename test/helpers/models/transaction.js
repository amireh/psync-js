define(function(require) {
  var Pixy = require('pixy');

  var TransactionModel = Pixy.Model.extend({
    defaults: {
      amount: 0,
      note: ''
    },

    baseUrl: function() {
      return this.collection.account.url() + '/transactions';
    }
  });

  return TransactionModel;
});