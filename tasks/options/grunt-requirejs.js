var _ = require('lodash');
var extend = _.extend;

var baseConfig = {
  baseUrl: './lib',
  mainConfigFile: '.requirejs',

  removeCombined:           false,
  inlineText:               true,
  preserveLicenseComments:  false,

  pragmas: {
    production: true
  },

  paths: {
    'pixy': 'empty:',
    'rsvp': 'empty:',
    'inflection': 'empty:',
    'lodash': 'empty:',
  },

  name: 'psync',
  deps: [ 'psync' ]
};

module.exports = {
  development: {
    options: extend({}, baseConfig, {
      out: 'dist/psync.js',
      optimize: 'none',
    })
  },

  production: {
    options: extend({}, baseConfig, {
      out: 'dist/psync.min.js',
      optimize: 'uglify2',

      uglify2: {
        warnings: true,
        mangle:   true,

        output: {
          beautify: false
        },

        compress: {
          sequences:  true,
          dead_code:  true,
          loops:      true,
          unused:     true,
          if_return:  true,
          join_vars:  true
        }
      }
    })
  },
};