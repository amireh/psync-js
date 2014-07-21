define(function(require) {
  var Psync = require('psync');
  var PixySuite = require('test/support/pixy_suite');
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

  describe('Psync.Pixy.sync', function() {
    var users, user, subject, flush;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      users = new Pixy.Collection(undefined, { model: User });
      user = users.push({});
      flush = this.flush.bind(this);
    });

    describe('CREATE', function() {
      it('should work', function() {
        spyOn(User.prototype, 'psync').and.returnValue({
          collectionKey: 'users'
        });

        expect(function() {
          user.save();
          flush();
        }).not.toThrow();

        expect(this.requests[0].url).toEqual('/users');
        expect(Psync.journal.length).toEqual(1);
        expect(Psync.journal.getEntries('/users', 'create')).toContain({
          id: user.cid,
          data: user.toJSON()
        });
      });

      it('should remove the entry if it was successfully synced', function() {
        spyOn(User.prototype, 'psync').and.returnValue({
          collectionKey: 'users'
        });

        expect(function() {
          user.save();
          flush();
        }).not.toThrow();

        expect(this.requests[0].url).toEqual('/users');
        expect(Psync.journal.length).toEqual(1);

        this.respondTo(this.requests[0], 200, {
          id: '1'
        });
        this.flush();

        expect(Psync.journal.records).toEqual([]);
      });
    });
  });
});