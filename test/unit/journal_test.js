define(function(require) {
  var subject = require('psync/journal');
  var Models = require('test/helpers/models/journaled_models');

  describe('Journal', function() {
    var user, onChange;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      onChange = jasmine.createSpy('onChange');
      user = Models.UserCollection.push({});
    });

    describe('Events', function() {
      it('should emit change on #append', function() {
        subject.on('change', onChange);
        subject.add('create', user);

        expect(onChange).toHaveBeenCalled();
      });

      it('should emit change on #remove', function() {
        var entry = subject.add('create', user);

        subject.on('change', onChange);
        subject.remove('create', user, entry);

        expect(onChange).toHaveBeenCalled();
      });

      it('should emit change on #clear', function() {
        subject.add('create', user);
        subject.on('change', onChange);
        subject.clear();

        expect(onChange).toHaveBeenCalled();
      });
    });

    describe('#discardProcessed', function() {
      describe('#create', function() {
        it('should discard entries using `shadow_id` as a resolver', function() {
          var userId = user.cid;

          subject.add('create', user);
          subject.on('change', onChange);
          subject.discardProcessed([
            {
              path: '/users',
              operations: {
                create: [{ id: '1', shadow_id: userId }]
              }
            }
          ]);

          expect(onChange).toHaveBeenCalled();
          expect(subject.length).toEqual(0);
        });

        it('should be a no-op if the resource could not be found', function() {
          subject.on('change', onChange);
          subject.discardProcessed([
            {
              path: '/users',
              operations: {
                create: [{ id: '1', shadow_id: 'foobar' }]
              }
            }
          ]);

          expect(onChange).not.toHaveBeenCalled();
          expect(subject.length).toEqual(0);
        });
      });

      describe('#update', function() {
        var userId = '1';

        beforeEach(function() {
          user.set('id', userId);
        });

        it('should work', function() {
          subject.add('update', user);
          subject.on('change', onChange);
          subject.discardProcessed([
            {
              path: '/users',
              operations: {
                update: [{ id: userId }]
              }
            }
          ]);

          expect(onChange).toHaveBeenCalled();
          expect(subject.length).toEqual(0);
        });
      });

      describe('#delete', function() {
        var userId = '1';

        beforeEach(function() {
          user.set('id', userId);
        });

        it('should work', function() {
          subject.add('delete', user);
          subject.on('change', onChange);
          subject.discardProcessed([
            {
              path: '/users',
              operations: {
                delete: [{ id: userId }]
              }
            }
          ]);

          expect(onChange).toHaveBeenCalled();
          expect(subject.length).toEqual(0);
        });
      });
    });

    describe('#removeAt', function() {
      it('should work', function() {
        user.set('id', '1')
        subject.add('update', user);
        expect(subject.length).toEqual(1);
        subject.removeAt('/users/1', 'update');
        expect(subject.length).toEqual(0);
      });

      it('should work with shadow ids', function() {
        subject.add('create', user);
        expect(subject.length).toEqual(1);
        subject.removeAt('/users/' + user.cid, 'create');
        expect(subject.length).toEqual(0);
      });
    });
  });
});