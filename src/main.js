define(function (require, exports, module) {

  const Plugin = require('extplug/Plugin')
  const Events = require('plug/core/Events')
  const currentRoom = require('plug/models/currentRoom')
  const { defer } = require('underscore')
  const $ = require('jquery')

  const LS_KEY = 'epChatScrollbackHistory'
  // deletion flag to mark deletions triggered by the scrollback plugin
  const REDELETE = {}
  // TODO use number input setting once ExtPlug supports that
  const LIMIT = 512

  const ChatScrollback = Plugin.extend({
    name: 'Chat Scrollback',
    description: 'Remembers chat messages from earlier sessions.',

    enable() {
      return this.disable()

      this.chat = this.load()

      Events.on('chat:receive', this.onReceive, this)
      Events.on('chat:delete', this.onDelete, this)
      Events.on('room:joined', this.onJoined, this)
      if (currentRoom.get('joined')) {
        this.onJoined()
      }
    },

    disable() {
      this.save(this.chat)
      Events.off('chat:receive', this.onReceive)
      Events.off('chat:delete', this.onDelete)
      Events.off('room:joined', this.onJoined)

      this.chat = null
    },

    onReceive(msg) {
      // ignore messages that were triggered by the plugin
      if (!msg.epReceived && msg.type !== 'welcome') {
        msg.epReceived = Date.now()
        msg.epSlug = location.pathname.slice(1)
        this.chat.push(msg)
        if (this.chat.length > this.settings.get('limit')) {
          this.chat.shift()
        }
        this.save(this.chat)
      }
    },

    // mark deleted messages as such in the scrollback history
    onDelete(cid, prop) {
      // this is triggered by the plugin
      if (prop === REDELETE) {
        return
      }
      this.chat.some(msg => {
        if (msg.cid === cid) {
          msg.epDeleted = true
          // break
          return true
        }
      })
    },

    load() {
      try {
        let chat = JSON.parse(localStorage.getItem(LS_KEY))
        if (Array.isArray(chat)) {
          return chat
        }
      }
      catch (e) {}
      return []
    },
    save(chat) {
      localStorage.setItem(LS_KEY, JSON.stringify(chat))
    },

    onJoined() {
      clearTimeout(this.timeout)
      let slug = location.pathname.slice(1)
      let chat = this.chat.filter(msg => msg.epSlug === slug && msg.epReceived < Date.now() - 1)
      // wait for other plugins to register
      this.timeout = setTimeout(() => {
        // insert old chat messages _before_ new ones
        let newMessages = $('#chat-messages').children().remove()
        chat.forEach(msg => {
          Events.trigger('chat:receive', msg)
          if (msg.epDeleted) {
            defer(() => { Events.trigger('chat:delete', msg.cid, REDELETE) })
          }
        })
        $('#chat-messages').append(newMessages)

        if (chat.length > 0) {
          let last = new Date(chat[chat.length - 1].epReceived)
          Events.trigger('chat:receive', {
            type: 'log',
            classes: 'extplug-scrollback',
            message: `Loaded scrollback from ${last.toLocaleString()}`
          })
        }
      }, 500)
    }

  })

  module.exports = ChatScrollback

})
