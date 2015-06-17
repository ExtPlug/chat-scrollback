

define('extplug/chat-scrollback/main',['require','exports','module','extplug/Plugin','plug/core/Events','plug/models/currentRoom','underscore','jquery'],function (require, exports, module) {

  var Plugin = require('extplug/Plugin');
  var Events = require('plug/core/Events');
  var currentRoom = require('plug/models/currentRoom');

  var _require = require('underscore');

  var defer = _require.defer;

  var $ = require('jquery');

  var LS_KEY = 'epChatScrollbackHistory';
  // deletion flag to mark deletions triggered by the scrollback plugin
  var REDELETE = {};
  // TODO use number input setting once ExtPlug supports that
  var LIMIT = 512;

  var ChatScrollback = Plugin.extend({
    name: 'Chat Scrollback',
    description: 'Remembers chat messages from earlier sessions.',

    enable: function enable() {
      this._super();

      this.chat = this.load();

      Events.on('chat:receive', this.onReceive, this);
      Events.on('chat:delete', this.onDelete, this);
      Events.on('room:joined', this.onJoined, this);
      if (currentRoom.get('joined')) {
        this.onJoined();
      }
    },

    disable: function disable() {
      this.save(this.chat);
      Events.off('chat:receive', this.onReceive);
      Events.off('chat:delete', this.onDelete);
      Events.off('room:joined', this.onJoined);

      this.chat = null;
    },

    onReceive: function onReceive(msg) {
      // ignore messages that were triggered by the plugin
      if (!msg.epReceived && msg.type !== 'welcome') {
        msg.epReceived = Date.now();
        msg.epSlug = location.pathname.slice(1);
        this.chat.push(msg);
        if (this.chat.length > this.settings.get('limit')) {
          this.chat.shift();
        }
        this.save(this.chat);
      }
    },

    // mark deleted messages as such in the scrollback history
    onDelete: function onDelete(cid, prop) {
      // this is triggered by the plugin
      if (prop === REDELETE) {
        return;
      }
      this.chat.some(function (msg) {
        if (msg.cid === cid) {
          msg.epDeleted = true;
          // break
          return true;
        }
      });
    },

    load: function load() {
      try {
        var chat = JSON.parse(localStorage.getItem(LS_KEY));
        if (Array.isArray(chat)) {
          return chat;
        }
      } catch (e) {}
      return [];
    },
    save: function save(chat) {
      localStorage.setItem(LS_KEY, JSON.stringify(chat));
    },

    onJoined: function onJoined() {
      clearTimeout(this.timeout);
      var slug = location.pathname.slice(1);
      var chat = this.chat.filter(function (msg) {
        return msg.epSlug === slug && msg.epReceived < Date.now() - 1;
      });
      // wait for other plugins to register
      this.timeout = setTimeout(function () {
        // insert old chat messages _before_ new ones
        var newMessages = $('#chat-messages').children().remove();
        chat.forEach(function (msg) {
          Events.trigger('chat:receive', msg);
          if (msg.epDeleted) {
            defer(function () {
              Events.trigger('chat:delete', msg.cid, REDELETE);
            });
          }
        });
        $('#chat-messages').append(newMessages);

        if (chat.length > 0) {
          var last = new Date(chat[chat.length - 1].epReceived);
          Events.trigger('chat:receive', {
            type: 'log',
            classes: 'extplug-scrollback',
            message: 'Loaded scrollback from ' + last.toLocaleString()
          });
        }
      }, 500);
    }

  });

  module.exports = ChatScrollback;
});
