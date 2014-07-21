define(function(require) {
  var Journal = require('psync/journal');
  var Models = require('test/helpers/models/journaled_models');

  describe('Journal', function() {
    describe('Events', function() {
      var user, onChange;

      jasmine.PixySuite.call(this);

      beforeEach(function() {
        onChange = jasmine.createSpy('onChange');
        user = Models.UserCollection.push({});
      });

      it('should emit change on #append', function() {
        Journal.on('change', onChange);
        Journal.add('create', user);

        expect(onChange).toHaveBeenCalled();
      });

      it('should emit change on #remove', function() {
        var entry = Journal.add('create', user);

        Journal.on('change', onChange);
        Journal.remove('create', user, entry);

        expect(onChange).toHaveBeenCalled();
      });

      it('should emit change on #clear', function() {
        Journal.add('create', user);
        Journal.on('change', onChange);
        Journal.clear();

        expect(onChange).toHaveBeenCalled();
      });
    })
  });
});