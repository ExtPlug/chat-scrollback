

define('extplug/chat-scrollback/main',['require','exports','module','extplug/Plugin','plug/core/Events','plug/models/currentRoom','underscore','jquery'],function (require, exports, module) {

  var Plugin = require('extplug/Plugin');
  var Events = require('plug/core/Events');
  var currentRoom = require('plug/models/currentRoom');

  var _require = require('underscore');

  var defer = _require.defer;
  var debounce = _require.debounce;

  var $ = require('jquery');

  var LS_KEY = 'epChatScrollbackHistory';
  // deletion flag to mark deletions triggered by the scrollback plugin
  var REDELETE = {};
  // TODO use number input setting once ExtPlug supports that
  var LIMIT = 512;

  var ChatScrollback = Plugin.extend({
    name: 'Chat Scrollback (Experimental)',
    description: 'Remembers chat messages from earlier sessions. Works in up to 5 rooms.',

    enable: function enable() {
      this.listenTo(Events, 'chat:receive', this.onReceive);
      this.listenTo(Events, 'chat:delete', this.onDelete);
      this.listenTo(Events, 'room:joined', this.onJoined);
      if (currentRoom.get('joined')) {
        this.onJoined();
      }

      this.saveSometimes = debounce(this.save.bind(this), 200);

      API.chatLog('The Chat Scrollback plugin is experimental, and might not always function properly. If you\'re having issues using plug.dj, try disabling the Scrollback plugin!');
    },

    disable: function disable() {
      this.save();
      this.chat = null;
    },

    onReceive: function onReceive() {
      this.chat = $('#chat-messages').html();
      this.saveSometimes();
    },
    onDelete: function onDelete() {
      this.chat = $('#chat-messages').html();
      this.saveSometimes();
    },

    load: function load() {
      try {
        var chat = JSON.parse(localStorage.getItem(LS_KEY));
        // old-style scrollback storage
        if (Array.isArray(chat)) {
          localStorage.setItem(LS_KEY, '');
          chat = {};
        }
        if (typeof chat === 'object') {
          return chat[currentRoom.get('slug')] || '';
        }
      } catch (e) {}
      return [];
    },
    save: function save() {
      var ls = undefined;
      try {
        ls = JSON.parse(localStorage.getItem(LS_KEY)) || {};
      } catch (e) {
        ls = {};
      }
      ls[currentRoom.get('slug')] = {
        chat: this.chat,
        time: Date.now()
      };

      this.prune(ls);

      localStorage.setItem(LS_KEY, JSON.stringify(ls));
    },

    // keeps only the 5 most recent caches
    prune: function prune(ls) {
      var keys = Object.keys(ls);
      if (keys.length > 5) {
        keys.sort(function (a, b) {
          if (ls[a].time > ls[b].time) return -1;
          if (ls[a].time < ls[b].time) return 1;
          return 0;
        });
        keys.slice(5).forEach(function (key) {
          delete ls[key];
        });
      }
    },

    insertScrollback: function insertScrollback(scrollback) {
      $('#chat-messages').prepend(scrollback);
      return;
      // insert old chat messages _before_ new ones
      var newMessages = $('#chat-messages').children().remove();
      scrollback.forEach(function (msg) {
        Events.trigger('chat:receive', msg);
        if (msg.epDeleted) {
          defer(function () {
            return Events.trigger('chat:delete', msg.cid, REDELETE);
          });
        }
      });
      $('#chat-messages').append(newMessages);
    },

    onJoined: function onJoined() {
      var _this = this;

      this.chat = (this.load() || {}).chat;
      if (this.chat) {
        defer(function () {
          _this.insertScrollback(_this.chat);
        });
      }
    }

  });

  module.exports = ChatScrollback;
});
