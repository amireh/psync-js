define(function(require) {
  var mkCreateEntry = require('psync/journal/processors/create');
  var Models = require('test/helpers/models/journaled_models');

  describe('Journal.Create', function() {
    var user;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      user = Models.UserCollection.push({});
    });

    it('should work', function() {
      user.cid = 'foobar';
      user.set('name', 'Ahmad');

      expect(mkCreateEntry(user)).toEqual({
        id: 'foobar',
        data: {
          name: 'Ahmad'
        }
      });
    });
  });
});