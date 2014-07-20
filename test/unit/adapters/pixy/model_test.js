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
    this.promiseSuite = true;
    this.serverSuite = {
      trackRequests: true
    };

    beforeEach(function() {
      Psync.Adapters.Pixy.install();
    });

    afterEach(function() {
      Psync.Adapters.Pixy.uninstall();
    });

    describe('Model#getJournalPath', function() {
      var users, user, subject;

      beforeEach(function() {
        users = new Pixy.Collection(undefined, { model: User });
        user = users.push({});
      });

      it('should work', function() {
        spyOn(User.prototype, 'psync').and.returnValue({
          collectionKey: 'users'
        });

        expect(user.getJournalPath()).toEqual('/users');
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
        expect(subject.getJournalPath()).toEqual('/users/1/accounts');
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

        expect(transaction.getJournalPath()).toEqual('/users/1/accounts/2/transactions');
      });

    });
  });
});