/* global requirejs: false, jasmine: false */
requirejs.config({
  baseUrl: '../lib',

  map: {
    '*': {
      'test': '../../test',
      'underscore': 'lodash'
    }
  },

  paths: {
    'pixy': '../node_modules/pixy/dist/pixy',
    'pixy-jasmine': '../node_modules/pixy/dist/pixy-jasmine',
    'lodash': '../node_modules/pixy/vendor/underscore',
    'rsvp': '../node_modules/pixy/dist/pixy',
    'router': '../node_modules/pixy/dist/pixy',
    'inflection': '../node_modules/pixy/vendor/inflection',
    'react': '../node_modules/pixy/vendor/react-0.10.0',
    'jquery': '../node_modules/jquery/dist/jquery',
  },

  deps: [
    'pixy',
    'pixy-jasmine'
  ],

  callback: function() {
  }
});