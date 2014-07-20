define(function() {
  var onError, lastHandler, exports;

  onError = function(error) {
    if (typeof error === 'string') {
      throw new Error(error);
    } else {
      throw error;
    }
  };

  exports = function() {
    return onError.apply(this, arguments);
  };

  exports.configure = function(errorHandler) {
    lastHandler = onError;
    onError = errorHandler;
  };

  exports.restore = function() {
    onError = lastHandler;
    lastHandler = undefined;
  }

  return exports;
});