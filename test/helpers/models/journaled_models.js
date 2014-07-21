define(function(require) {
  var Pixy = require('pixy');
  var ModelMixin = require('psync/adapters/pixy/model');
  var BaseUser = require('test/helpers/models/user');
  var BaseAccount = require('test/helpers/models/account');
  var BaseTransaction = require('test/helpers/models/transaction');

  var Transaction = BaseTransaction.extend({
    psync: {
      collectionKey: 'transactions',
      scopeKey: 'account'
    },

    mixins: [ ModelMixin ]
  });

  var Account = BaseAccount.extend({
    psync: {
      collectionKey: 'accounts',
      scopeKey: 'user'
    },

    mixins: [ ModelMixin ],
    transactionModel: Transaction
  });

  var User = BaseUser.extend({
    psync: {
      collectionKey: 'users'
    },

    mixins: [ ModelMixin ],
    accountModel: Account
  });

  return {
    User: User,
    Account: Account,
    Transaction: Transaction,
    UserCollection: new Pixy.Collection(undefined, { model: User })
  };
});