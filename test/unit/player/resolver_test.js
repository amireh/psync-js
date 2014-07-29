define(function(require) {
  var Psync = require('psync');
  var Pixy = require('pixy');
  var User = require('test/helpers/models/user');
  var subject = require('psync/player/resolver');

  describe('Player.Resolver', function() {
    var collection, user, account, userCollection;

    this.promiseSuite = true;
    this.serverSuite = {
      trackRequests: true
    };

    beforeEach(function() {
      userCollection = new Pixy.Collection(undefined, { model: User });
      user = userCollection.push({
        id: '1'
      });

      user.accounts.reset([{
        id: '1',
        links: {
          transactions: '/users/1/accounts/1/transactions'
        }
      }]);

      account = user.accounts.get('1');

      Psync.configure('rootScope', { users: userCollection });
    });

    afterEach(function() {
      Psync.configure.restore('rootScope');
    });

    describe('#resolveResource', function() {
      it('should work', function() {
        expect(subject.resolveResource('/users/1/accounts/1')).toBe(user.accounts.get('1'));
      });
    });
  });
});