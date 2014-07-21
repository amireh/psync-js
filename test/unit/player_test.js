define(function(require) {
  var Psync = require('psync');
  var Player = require('psync/player');
  var Pixy = require('pixy');
  var User = require('test/helpers/models/user');
  var Player = Player;

  describe('Player', function() {
    var collection, user, account, userCollection, lastRootScope;

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

      lastRootScope = Psync.configure('rootScope', { users: userCollection });
    });

    afterEach(function() {
      Psync.configure('rootScope', lastRootScope);
    });

    describe('#processed', function() {
      describe('CREATE', function() {
        beforeEach(function() {
          collection = user.accounts.get('1').transactions;
        });

        it('should create a resource', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                create: [{ id: '1' }]
              }
            }]
          });

          var request = this.requests[0];

          expect(this.requests.length).toEqual(1);
          expect(request.url).toEqual('/users/1/accounts/1/transactions/1');

          this.respondTo(request, 200, {}, {
            id: '1',
            amount: 10.5
          });
        });

        it('should not create a resource if it could not be fetched', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                create: [{ id: '1' }]
              }
            }]
          });

          var request = this.requests[0];

          expect(collection.length).toEqual(1);

          expect(this.requests.length).toEqual(1);
          expect(request.url).toEqual('/users/1/accounts/1/transactions/1');

          this.respondTo(request, 404, {}, {});

          expect(collection.length).toEqual(0);
        });

        it('should be a NOOP if the resource exists', function() {
          user.accounts.get('1').transactions.push({ id: '1' });

          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                create: [{ id: '1' }]
              }
            }]
          });

          expect(this.requests.length).toEqual(0);
        });
      });

      describe('UPDATE', function() {
        beforeEach(function() {
          user.accounts.get('1').transactions.reset([{
            id: '1',
            amount: 10,
            href: '/users/1/accounts/1/transactions/1'
          }]);
        });

        it('should fetch a newly-updated resource', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                update: [{ id: '1' }]
              }
            }]
          });

          var request = this.requests[0];

          expect(this.requests.length).toEqual(1);
          expect(request.url).toEqual('/users/1/accounts/1/transactions/1');

          this.respondTo(request, 200, {}, {
            id: '1',
            amount: 20
          });

          expect(user.accounts.get('1').transactions.get('1').get('amount')).toEqual(20);
        });

        it('should fetch an updated resource that doesnt exist locally', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                update: [{ id: '2' }]
              }
            }]
          });

          var request = this.requests[0];

          expect(this.requests.length).toEqual(1);
          expect(request.url).toEqual('/users/1/accounts/1/transactions/2');

          this.respondTo(request, 200, {}, {
            id: '2',
            amount: 20
          });

          expect(user.accounts.get('1').transactions.get('2').get('amount')).toEqual(20);
        });
      });

      describe('DELETE', function() {
        beforeEach(function() {
          user.accounts.get('1').transactions.reset([{
            id: '1',
            amount: 10,
            href: '/users/1/accounts/1/transactions/1'
          }]);
        });

        it('should remove a resource', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                "delete": [{ id: '1' }]
              }
            }]
          });

          expect(this.requests.length).toEqual(0);
          expect(user.accounts.get('1').transactions.get('1')).toBeFalsy();
          expect(user.accounts.get('1').transactions.length).toEqual(0);
        });

        it('should be a NOOP if the resource doesnt exist', function() {
          Player.play({
            processed: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                "delete": [{ id: '2' }]
              }
            }]
          });

          expect(this.requests.length).toEqual(0);
          expect(user.accounts.get('1').transactions.length).toEqual(1);
        });
      });

      it('should emit events on success', function() {
        var onChange = jasmine.createSpy('onChange');
        var request, args;

        Player.on('transactions:create', onChange);

        user.accounts.reset([{
          id: '1',
          links: {
            transactions: '/users/1/accounts/1/transactions'
          }
        }]);

        Player.play({
          processed: [{
            path: "/users/1/accounts/1/transactions",
            operations: {
              create: [{ id: '1' }]
            }
          }]
        });

        request = this.requests[0];

        expect(this.requests.length).toEqual(1);
        expect(request.url).toEqual('/users/1/accounts/1/transactions/1');

        this.respondTo(request, 200, {
          id: '1',
          amount: 10.5
        });

        this.flush();

        expect(onChange).toHaveBeenCalledWith('1', {
          path: '/users/1/accounts/1/transactions',
          rollingBack: false,
          selfOrigin: false
        });
      });
    });

    describe('#dropped', function() {
      describe('CREATE', function() {
        it('should remove an existing resource', function() {
          account.transactions.reset([{
            id: '1',
            amount: -5
          }]);

          Player.play({
            dropped: [{
              path: '/users/1/accounts/1/transactions',
              operations: {
                create: [{
                  id: '1',
                  error: {
                    message: 'Amount must be a positive number.'
                  }
                }]
              }
            }]
          }, true);

          this.flush();

          expect(this.requests.length).toEqual(0);
          expect(account.transactions.length).toEqual(0);
        });

        it('should be a NOOP if the resource does not exist', function() {
          expect(function() {
            Player.play({
              dropped: [{
                path: '/users/1/accounts/1/transactions',
                operations: {
                  create: [{ id: '1', error: {} }]
                }
              }]
            }, true);
          }).not.toThrow();

          expect(account.transactions.length).toEqual(0);
        });

        it('should emit the @delete event', function() {
          var onCreate = jasmine.createSpy('onCreate');
          var onDelete = jasmine.createSpy('onDelete');

          Player.on('transactions:create', onCreate);
          Player.on('transactions:delete', onDelete);

          account.transactions.reset([{
            id: '1',
            amount: -5
          }]);

          Player.play({
            dropped: [{
              path: '/users/1/accounts/1/transactions',
              operations: {
                create: [{
                  id: '1',
                  error: {
                    message: 'Amount must be a positive number.'
                  }
                }]
              }
            }]
          }, true);

          this.flush();

          expect(onCreate).not.toHaveBeenCalled();
          expect(onDelete).toHaveBeenCalledWith('1', {
            path: '/users/1/accounts/1/transactions',
            rollingBack: true,
            selfOrigin: true
          });
        });
      });

      describe('UPDATE', function() {
        beforeEach(function() {
          user.accounts.get('1').transactions.reset([{
            id: '1',
            amount: 10,
            href: '/users/1/accounts/1/transactions/1'
          }]);
        });

        it('should re-fetch the resource', function() {
          var request;

          Player.play({
            dropped: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                update: [{ id: '1', error: {} }]
              }
            }]
          }, true);

          request = this.requests[0];

          expect(this.requests.length).toEqual(1);
          expect(request.url).toEqual('/users/1/accounts/1/transactions/1');

          this.respondTo(request, 200, {}, {
            id: '1',
            amount: 20
          });

          expect(user.accounts.get('1').transactions.get('1').get('amount')).toEqual(20);
        });

        it('should emit the @update event', function() {
          var onUpdate = jasmine.createSpy('onUpdate');

          Player.on('transactions:update', onUpdate);

          Player.play({
            dropped: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                update: [{ id: '1', error: {} }]
              }
            }]
          }, true);

          this.respondTo(this.requests[0], 200, {}, {
            id: '1',
            amount: 20
          });

          expect(onUpdate).toHaveBeenCalled();
        });
      });

      describe('DELETE', function() {
        it('should re-create a resource', function() {
          Player.play({
            dropped: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                "delete": [{ id: '1', error: {} }]
              }
            }]
          }, true);

          expect(this.requests.length).toEqual(1);
          expect(this.requests[0].url).toEqual('/users/1/accounts/1/transactions/1');

          this.respondTo(this.requests[0], 200, {}, {
            id: '1',
            amount: 20
          });

          expect(user.accounts.get('1').transactions.length).toEqual(1);
        });

        it('should emit the @create event', function() {
          var onCreate = jasmine.createSpy('onCreate');
          var onDelete = jasmine.createSpy('onDelete');

          Player.on('transactions:create', onCreate);
          Player.on('transactions:delete', onDelete);

          Player.play({
            dropped: [{
              path: "/users/1/accounts/1/transactions",
              operations: {
                "delete": [{ id: '1', error: {} }]
              }
            }]
          }, true);

          this.respondTo(this.requests[0], 200, {}, {
            id: '1',
            amount: 20
          });

          expect(onCreate).toHaveBeenCalled();
          expect(onDelete).not.toHaveBeenCalled();
        });
      });
    });
  });
});