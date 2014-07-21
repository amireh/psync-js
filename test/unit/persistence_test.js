define(function(require) {
  var Psync = require('psync');
  var Models = require('test/helpers/models/journaled_models');
  var journal = require('psync/journal');

  describe('Persistence', function() {
    var user, configFlag;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      configFlag = Psync.configure('persistent');
      user = Models.UserCollection.push({});
      Psync.configure('persistent', true);
    });

    afterEach(function() {
      Psync.configure('persistent', configFlag);
    });

    it('should save in localStorage', function() {
      journal.add('create', user);

      expect(localStorage.journal).toEqual(JSON.stringify(journal.toJSON()));
    });

    it('should clear the item when the journal is cleared', function() {
      journal.add('create', user);

      expect(localStorage.journal).toBeTruthy();

      journal.clear();
      expect(localStorage.journal).toBeFalsy();
    });

    it('should do nothing if disabled', function() {
      Psync.configure('persistent', false);

      journal.add('create', user);
      expect(localStorage.journal).toBeFalsy();
    })
  });
});