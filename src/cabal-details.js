const EventEmitter = require('events')
const ChannelDetails = require("./channel-details")

class CabalDetails extends EventEmitter {
  constructor(cabal, pageSize) {
    super()
    this._cabal = cabal
    this.key = cabal.key
    
    this.joinedChannels = []
    this.pageSize = pageSize

    this.channels = {
      // '!status': new ChannelDetails() // ???: what does this need?
      'default': new ChannelDetails(this._cabal, "default") // 
    }
    
    // make default the first channel if no saved state exists
    this.currentChannel = this.channels["default"] // a ChannelDetails instance
    this.name = ''
    this.topic = ''
    this.users = {} // public keys -> cabal-core user?
    this.listeners = [] // keep track of listeners so we can remove them when we remove a cabal
    this.user = { local: true, online: true, key: '', name: '' }
    this._initialize()
  }

  _handleMention(message) {
      if (message.value.type !== "chat/text") return null
      let name = this.user.name || this.user.key.slice(0, 8)
      let line = message.value.content.text.trim()
      // a direct mention is if you're mentioned at the start of the message
      // an indirect (or not direct) mention is if you're mentioned somewhere in the message
      let directMention = (line.slice(0, name.length) === name)
      message.directMention = directMention
      return line.includes(name) ? message : null
  }

  messageListener(message) {
    let channel = message.value.content.channel
    let mention = this._handleMention(message)
    this.channels[channel].handleMessage(message)
    if (mention) this.channels[channel].addMention(message)
    this._emitUpdate()
      // publish message up to consumer
    /* `message` is of type
    { 
      key: '<peer public key>',
      seq: 454,
      value:
        { 
          content: { channel: 'testing', text: 'umm well' },
          type: 'chat/text',
          timestamp: 1560999208134 
        } 
    }
    */
  }

  publishMessage(msg, opts, cb) {
    if (!cb) { cb = noop } 
    if (!msg.content.channel) {
      msg.content.channel = this.currentChannel.name
    }
    if (!msg.type) msg.type = "chat/text"
      this._cabal.publish(msg, opts, (err, m) => {
          this._emitUpdate()
          cb(err, m)
      })
  }

  publishNick(nick, cb) {
    this._cabal.publishNick(nick, cb)
  }

  publishChannelTopic(channel, topic, cb) {
    this._cabal.publishChannelTopic(channel, topic, cb)
  }

  getTopic(channel=this.currentChannel.name) {
    return this.channels[channel].topic || ''
  }

  openChannel(channel) {
    this.currentChannel.close()
    this.currentChannel = this.channels[channel]
    const unreadState = this.currentChannel.open()
    this._emitUpdate()
    return unreadState
  }

  closeChannel(channel) {
    var joined = this.getJoinedChannels()
    this.channels[channel].close()
    var index = joined.indexOf(channel)
    // open the channel before this one
    if (joined.length > 1) {
      var newIndex 
      if (index === 0) { newIndex = joined.length - 1}
      else { newIndex = index - 1 }
      var newChannel = joined[newIndex]
      this.openChannel(newChannel) // will this cause weird behaviour?
    }
  }

  getChannels() {
    return Object.keys(this.channels).sort()
  }

  // returns a ChannelDetails object
  getChannel(channel) {
    return this.channels[channel] || this.currentChannel
  }

  getCurrentChannel() {
      return this.currentChannel.name
  }

  getJoinedChannels() {
    return Object.keys(this.channels).filter(c => this.channels[c].joined).sort()
  }

  getLocalUser() {
    return this.user
  }
  
  joinChannel(channel) {
    var details = this.channels[channel]
    // we created a channel
    if (!details) {
        details = new ChannelDetails(this._cabal, channel)
        this.channels[channel] = details
    }
    // we weren't already in the channel
    if (details.join()) { 
      var joinMsg = {
        type: "chat/channel",
        content: {
          action: "join",
          channel
        }
      }
      // publish a join message to the cabal to signify our presence
      this._cabal.publish(joinMsg)
    }
    // we probably always want to open a joined channel?
    return this.openChannel(channel)
  }

  leaveChannel(channel) {
    var details = this.channels[channel]
    // we weren't already in the channel
    if (details.leave()) { 
      var leaveMsg = {
        type: "chat/channel",
        content: {
          action: "leave",
          channel
        }
      }
      this._cabal.publish(leaveMsg)
    }
    this.closeChannel(channel)
  }

  getUsers() {
    return this.users
  }

  _emitUpdate() {
    this.emit('update', this)
  }

  registerListener(source, event, listener) {
    this.listeners.push({ source, event, listener })
    source.on(event, listener)
  }

  _destroy () {
    this.listeners.forEach((obj) => { obj.source.removeListener(obj.event, obj.listener)})
  }

  _initializeUser() {
    this._cabal.getLocalKey((err, lkey) => {
      if (err) throw err
      // set local key for local user
      this.user.key = lkey
      // try to get more data for user
      this._cabal.users.get(lkey, (err, user) => {
          if (!user) { return }
        this.user = user
        this.user.local = true
        this.user.online = true
        this._emitUpdate()
      })
    })
  }

  _initialize() {
    const cabal = this._cabal
    // populate channels
    cabal.channels.get((err, channels) => {
      channels.forEach((channel) => {

        // for each channel, get the topic
        cabal.topics.get(channel, (err, topic) => {
            var details = new ChannelDetails(cabal, channel)
            details.topic = topic || ''
            // save the channel and listen for updates that happen within it
            this.channels[channel] = details
            cabal.messages.events.on(channel, this.messageListener.bind(this))
        })
      })
    })

    // register to be notified of new channels as they are created
    this.registerListener(cabal.channels.events, 'add', (channel) => {
      this.channels[channel] = new ChannelDetails(cabal, channel)
      // Calls fn with every new message that arrives in channel.
      cabal.messages.events.on(channel, this.messageListener.bind(this))
      this._emitUpdate()
    })

    cabal.users.getAll((err, users) => {
      if (err) return
      this.users = users
      this._initializeUser()

      this.registerListener(cabal.users.events, 'update', (key) => {
        cabal.users.get(key, (err, user) => {
          if (err) return
          this.users[key] = Object.assign(this.users[key] || {}, user)
          if (this.user && key === this.user.key) this.user = this.users[key]
          this._emitUpdate()
        })
      })

      this.registerListener(cabal.topics.events, 'update', (msg) => {
          var { channel, text } = msg.value.content
          this.channels[channel].topic = text || ''
          this._emitUpdate()
      })

      this.registerListener(cabal, 'peer-added', (key) => {
        var found = false
        Object.keys(this.users).forEach((k) => {
          if (k === key) {
            this.users[k].online = true
            found = true
          }
        })
        if (!found) {
          this.users[key] = {
            key: key,
            online: true
          }
        }
        this._emitUpdate()
      })

      this.registerListener(cabal, 'peer-dropped', (key) => {
        Object.keys(this.users).forEach((k) => {
          if (k === key) {
            this.users[k].online = false
          }
        })
        this._emitUpdate()
      })
    }) 
  }
}

function noop () {}

module.exports = CabalDetails
