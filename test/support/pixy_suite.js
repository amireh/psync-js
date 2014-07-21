require([ 'psync', 'psync/adapters/pixy' ], function(Psync, Adapter) {
  jasmine.PixySuite = function() {
    this.promiseSuite = true;
    this.serverSuite = {
      trackRequests: true
    };

    beforeEach(function() {
      Adapter.install();
      Psync.configure('adapter', Adapter);
    });

    afterEach(function() {
      Psync.configure('adapter', null);
      Adapter.uninstall();
    });
  };
});