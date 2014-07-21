define(function(require) {
  var Psync = require('psync');
  var Journal = require('psync/journal');
  var Models = require('test/helpers/models/journaled_models');

  describe('JournalOptimizer', function() {
    var lastFlag, user, onChange;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      onChange = jasmine.createSpy('onChange');
      user = Models.UserCollection.push({});

      lastFlag = Psync.configure('optimized', true);
    });

    afterEach(function() {
      Psync.configure('optimized', lastFlag);
    });

    it('should merge UPDATEs for the same resource', function() {
      user.set('id', '1');
      user.set('name', 'Ahmad');
      var firstEntry = Journal.add('update', user);

      expect(Journal.length).toEqual(1);

      user.set('name', 'Ahmad Amireh');
      var secondEntry = Journal.add('update', user);
      expect(Journal.length).toEqual(1);

      expect(Journal.getEntries('/users', 'update')[0]).toBe(secondEntry);
    });

    it('should merge UPDATEs with corresponding CREATEs', function() {
      user.cid = 'foobar';
      user.set('name', 'Ahmad');
      Journal.add('create', user);

      expect(Journal.length).toEqual(1);

      user.set('name', 'Ahmad Amireh');
      user.set('id', 'foobar');
      Journal.add('update', user);
      expect(Journal.length).toEqual(1);

      expect(Journal.getEntries('/users', 'update')).toEqual([]);

      var createEntry = Journal.getEntries('/users', 'create')[0];

      expect(createEntry.data).toEqual({
        name: 'Ahmad Amireh'
      });
    });

    it('should discard CREATEs and UPDATEs on corresponding DELETEs', function() {
      user.set('id', '1');
      user.set('name', 'Ahmad');
      Journal.add('update', user);

      expect(Journal.length).toEqual(1);

      Journal.add('delete', user);
      expect(Journal.length).toEqual(1);

      expect(Journal.getEntries('/users', 'update')).toEqual([]);
    });
  });
});