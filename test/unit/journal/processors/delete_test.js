define(function(require) {
  var mkDeleteEntry = require('psync/journal/processors/delete');
  var Models = require('test/helpers/models/journaled_models');

  describe('Journal.Create', function() {
    var user;

    jasmine.PixySuite.call(this);

    beforeEach(function() {
      user = Models.UserCollection.push({});
    });

    it('should work', function() {
      user.set('id', '1');

      expect(mkDeleteEntry(user)).toEqual({
        id: '1'
      });
    });

    it('should not work for models without an id', function() {
      expect(mkDeleteEntry(user)).toBeFalsy();
    });
  });
});