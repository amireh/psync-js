define(function(require) {
  var Pixy = require('pixy');
  var TransactionModel = require('./transaction');

  var AccountModel = Pixy.Model.extend({
    defaults: {
      name: 'Unlabelled Account'
    },

    transactionModel: TransactionModel,

    baseUrl: function() {
      return this.collection.user.url() + '/accounts';
    },

    initialize: function() {
      this.transactions = new Pixy.Collection(undefined, {
        model: this.transactionModel
      });

      this.transactions.account = this;
    }
  });

  return AccountModel;
});