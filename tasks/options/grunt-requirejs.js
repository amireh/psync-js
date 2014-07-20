module.exports = {
  compile: {
    options: {
      baseUrl: './lib',
      out: 'dist/psync.js',
      mainConfigFile: '.requirejs',
      optimize: 'uglify2',

      removeCombined:           false,
      inlineText:               true,
      preserveLicenseComments:  false,

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
      },

      pragmas: {
        production: true
      },

      paths: {
        'pixy': 'empty:',
        'lodash': 'empty:',
        'rsvp': 'empty:',
      },

      name: 'psync'
    }
  }
};