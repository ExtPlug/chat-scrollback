define(function (require, exports, module) {

  const Plugin = require('extplug/Plugin')
  const Events = require('plug/core/Events')
  const currentRoom = require('plug/models/currentRoom')
  const { defer, debounce } = require('underscore')
  const $ = require('jquery')

  const LS_KEY = 'epChatScrollbackHistory'
  // deletion flag to mark deletions triggered by the scrollback plugin
  const REDELETE = {}
  // TODO use number input setting once ExtPlug supports that
  const LIMIT = 512

  const ChatScrollback = Plugin.extend({
    name: 'Chat Scrollback (Experimental)',
    description: 'Remembers chat messages from earlier sessions. Works in up to 5 rooms.',

    enable() {
      this.listenTo(Events, 'chat:receive', this.onReceive)
      this.listenTo(Events, 'chat:delete', this.onDelete)
      this.listenTo(Events, 'room:joined', this.onJoined)
      if (currentRoom.get('joined')) {
        this.onJoined()
      }

      this.saveSometimes = debounce(this.save.bind(this), 200)

      API.chatLog('The Chat Scrollback plugin is experimental, and might not always function properly. If you\'re having issues using plug.dj, try disabling the Scrollback plugin!')
    },

    disable() {
      this.save()
      this.chat = null
    },

    onReceive() {
      this.chat = $('#chat-messages').html()
      this.saveSometimes()
    },
    onDelete() {
      this.chat = $('#chat-messages').html()
      this.saveSometimes()
    },

    load() {
      try {
        let chat = JSON.parse(localStorage.getItem(LS_KEY))
        // old-style scrollback storage
        if (Array.isArray(chat)) {
          localStorage.setItem(LS_KEY, '')
          chat = {}
        }
        if (typeof chat === 'object') {
          return chat[currentRoom.get('slug')] || ''
        }
      }
      catch (e) {}
      return []
    },
    save() {
      let ls
      try {
        ls = JSON.parse(localStorage.getItem(LS_KEY)) || {}
      }
      catch (e) {
        ls = {}
      }
      ls[currentRoom.get('slug')] = {
        chat: this.chat,
        time: Date.now()
      }

      this.prune(ls)

      localStorage.setItem(LS_KEY, JSON.stringify(ls))
    },

    // keeps only the 5 most recent caches
    prune(ls) {
      let keys = Object.keys(ls)
      if (keys.length > 5) {
        keys.sort((a, b) => {
          if (ls[a].time > ls[b].time) return -1
          if (ls[a].time < ls[b].time) return 1
          return 0
        })
        keys.slice(5).forEach(key => {
          delete ls[key]
        })
      }
    },

    insertScrollback(scrollback) {
      $('#chat-messages').prepend(scrollback)
      return
      // insert old chat messages _before_ new ones
      let newMessages = $('#chat-messages').children().remove()
      scrollback.forEach(msg => {
        Events.trigger('chat:receive', msg)
        if (msg.epDeleted) {
          defer(() => Events.trigger('chat:delete', msg.cid, REDELETE))
        }
      })
      $('#chat-messages').append(newMessages)
    },

    onJoined() {
      this.chat = (this.load() || {}).chat
      if (this.chat) {
        defer(() => {
          this.insertScrollback(this.chat)
        })
      }
    }

  })

  module.exports = ChatScrollback

})
