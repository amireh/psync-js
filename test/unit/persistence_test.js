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
    });

    describe('#load', function() {
      it('should overwrite the journal', function() {
        var dump;

        journal.add('create', user);
        dump = journal.toJSON();
        journal.clear();

        localStorage.journal = JSON.stringify(dump);
        Psync.Persistence.load();
        expect(journal.length).toEqual(1);
      });

      it('should not overwrite if the localStorage entry is bad', function() {
        var onChange = jasmine.createSpy('onChange');

        journal.add('create', user);
        journal.on('change', onChange);

        localStorage.journal = 'bad json';

        expect(function() {
          Psync.Persistence.load();
        }).not.toThrow();

        expect(journal.length).toEqual(1);
        expect(onChange).not.toHaveBeenCalled();
      });
    });
  });
});