define(function(require) {
  var Psync = require('psync');
  var ModelMixin = require('psync/adapters/pixy/model');
  var BaseUser = require('test/helpers/models/user');
  var BaseAccount = require('test/helpers/models/account');
  var BaseTransaction = require('test/helpers/models/transaction');

  var Transaction = BaseTransaction.extend({
    mixins: [ ModelMixin ]
  });

  var Account = BaseAccount.extend({
    mixins: [ ModelMixin ],
    transactionModel: Transaction
  });

  var User = BaseUser.extend({
    mixins: [ ModelMixin ],
    accountModel: Account
  });

  describe('Psync.Pixy.Model', function() {
    jasmine.PixySuite.call(this);
  });
});