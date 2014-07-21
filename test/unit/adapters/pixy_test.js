define(function(require) {
  var Psync = require('psync');
  var ModelMixin = require('psync/adapters/pixy/model');
  var BaseUser = require('test/helpers/models/user');
  var BaseAccount = require('test/helpers/models/account');
  var BaseTransaction = require('test/helpers/models/transaction');
  var Adapter = require('psync/adapters/pixy');

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

  describe('Pixy#getPathFor', function() {
    var users, user, subject, adapter;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      users = new Pixy.Collection(undefined, { model: User });
      user = users.push({});

      adapter = Adapter;
    });

    it('should work', function() {
      spyOn(User.prototype, 'psync').and.returnValue({
        collectionKey: 'users'
      });

      expect(adapter.getPathFor(user)).toEqual('/users');
    });

    it('should work with a scope', function() {
      spyOn(User.prototype, 'psync').and.returnValue({
        collectionKey: 'users'
      });

      spyOn(Account.prototype, 'psync').and.returnValue({
        collectionKey: 'accounts',
        scopeKey: 'user'
      });

      user.set('id', '1');
      subject = user.accounts.push({});
      expect(adapter.getPathFor(subject)).toEqual('/users/1/accounts');
    });

    it('should work with a scope, two levels deep', function() {
      spyOn(User.prototype, 'psync').and.returnValue({
        collectionKey: 'users'
      });

      spyOn(Account.prototype, 'psync').and.returnValue({
        collectionKey: 'accounts',
        scopeKey: 'user'
      });

      spyOn(Transaction.prototype, 'psync').and.returnValue({
        collectionKey: 'transactions',
        scopeKey: 'account'
      });

      var account = user.accounts.push({});
      var transaction = account.transactions.push({});

      user.set('id', '1');
      account.set('id', '2');

      expect(adapter.getPathFor(transaction)).toEqual('/users/1/accounts/2/transactions');
    });

  });
});