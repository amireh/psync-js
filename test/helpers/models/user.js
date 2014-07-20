define(function(require) {
  var Pixy = require('pixy');
  var AccountModel = require('./account');

  var UserModel = Pixy.Model.extend({
    defaults: {
      name: 'Guest'
    },

    url: '/users',

    accountModel: AccountModel,

    initialize: function() {
      this.accounts = new Pixy.Collection(undefined, {
        model: this.accountModel
      });

      this.accounts.user = this;
    }
  });

  return UserModel;
});