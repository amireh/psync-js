define(function(require) {
  var Psync = require('psync');
  var User = require('test/helpers/models/user');

  describe('Psync', function() {
    this.promiseSuite = true;
    this.serverSuite = {
      trackRequests: true
    };

    beforeEach(function() {
      Psync.Adapters.Pixy.install();
    });

    afterEach(function() {
      Psync.Adapters.Pixy.uninstall();
    });

    it('should include without errors', function() {
    });

    describe('Model#save', function() {
      it('should intercept a model being saved', function() {
        var user = new User();

        user.save();
        expect(this.requests[0].url).toEqual('/users');
      });
    });
  });
});