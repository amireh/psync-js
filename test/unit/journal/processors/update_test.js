define(function(require) {
  var mkUpdateEntry = require('psync/journal/processors/update');
  var Models = require('test/helpers/models/journaled_models');

  describe('Journal.Create', function() {
    var user;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      user = Models.UserCollection.push({});
    });

    it('should work', function() {
      user.set('id', '1');
      user.set('name', 'Ahmad');

      expect(mkUpdateEntry(user)).toEqual({
        id: '1',
        data: {
          name: 'Ahmad'
        }
      });
    });

    it('should not work for models without an id', function() {
      user.set('name', 'Ahmad');
      expect(mkUpdateEntry(user)).toBeFalsy();
    });

  });
});