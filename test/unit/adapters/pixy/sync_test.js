define(function(require) {
  var Psync = require('psync');
  var PixySuite = require('test/support/pixy_suite');
  var ModelMixin = require('psync/adapters/pixy/model');
  var BaseUser = require('test/helpers/models/user');

  var User = BaseUser.extend({
    mixins: [ ModelMixin ]
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
      beforeEach(function() {
        spyOn(User.prototype, 'psync').and.returnValue({
          collectionKey: 'users'
        });

        expect(function() {
          user.save();
          flush();
        }).not.toThrow();
      });

      it('should work', function() {
        expect(Psync.journal.length).toEqual(1);
        expect(Psync.journal.getEntries('/users', 'create')).toContain({
          id: user.cid,
          data: user.toPsync()
        });
      });

      it('should remove the entry if it was successfully synced', function() {
        expect(Psync.journal.length).toEqual(1);

        this.respondTo(this.requests[0], 200, {
          id: '1'
        });
        this.flush();

        expect(Psync.journal.records).toEqual([]);
      });

      it('should remove the entry on 400 or 422 remote errors', function() {
        expect(Psync.journal.length).toEqual(1);

        this.respondTo(this.requests[0], 400, {
        });

        expect(Psync.journal.records).toEqual([]);
      });

      it('should not remove the entry on other remote errors', function() {
        expect(Psync.journal.length).toEqual(1);

        this.respondTo(this.requests[0], 500, {});

        expect(Psync.journal.length).toEqual(1);
      });

      it('should not add an entry on local validation failures', function() {
        Psync.journal.clear();
        spyOn(User.prototype, '_validate').and.returnValue(false);

        user.save();
        this.flush();

        expect(Psync.journal.length).toEqual(0);
      });
    });
  });
});