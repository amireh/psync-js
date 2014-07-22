require([ 'psync' ],function(Psync) {
  PIXY_TEST = true;

  jasmine.pixy.logRSVPErrors = false;

  // Avoid infinite loop in the pretty printer when trying to print objects with
  // circular references.
  jasmine.MAX_PRETTY_PRINT_DEPTH = 3;

  beforeEach(function() {
    Psync.Journal.clear();
  });
});