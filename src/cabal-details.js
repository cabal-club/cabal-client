const EventEmitter = require('events')
const debug = require("debug")("cabal-client")
const { VirtualChannelDetails, ChannelDetails } = require("./channel-details")
const User = require("./user")
const to = require("to2")
const pump = require("pump")
const Moderation = require("./moderation")
const collect = require('collect-stream')
const { nextTick } = process

/**
 * @typedef user
 * @property {boolean} local
 * @property {boolean} online 
 * @property {string} name The user's username
 * @property {string} key The user's public key
 * @property {Map<string,string>} flags The user's array of flags per channel
 *   ("@" means cabal-wide"). Possible flags include
 *   {"admin", "mod", "normal", "hide", "mute", "block"}.
 * 
 * @event CabalDetails#update
 * @type {CabalDetails}
 */

class CabalDetails extends EventEmitter {
  /**
   * 
   * @constructor
   * @fires CabalDetails#update
   * @fires CabalDetails#init
   * @fires CabalDetails#user-updated
   * @fires CabalDetails#new-channel
   * @fires CabalDetails#new-message
   * @fires CabalDetails#publish-message
   * @fires CabalDetails#publish-nick
   * @fires CabalDetails#status-message
   * @fires CabalDetails#topic
   * @fires CabalDetails#channel-focus
   * @fires CabalDetails#channel-join
   * @fires CabalDetails#channel-leave
   * @fires CabalDetails#cabal-focus
   * @fires CabalDetails#started-peering
   * @fires CabalDetails#stopped-peering
   * @param {object} { cabal , commands, aliases }
   * @param {function} done the function to be called after the cabal is initialized
   */
  constructor({ cabal, client, commands, aliases }, done) {
    super()
    this._cabal = cabal
    this.core = cabal
    this.client = client
    this._commands = commands || {}
    this._aliases = aliases || {}
    this._res = {
      info: (msg) => {
        this._emitUpdate("info", msg)
      },
      error: (err) => {
        this._emitUpdate("error", err)
      },
      end: () => {
        // does nothing right now but may emit an event to indicate the command
        // has finished in the future
      }
    }
    this.key = cabal.key
    this.moderation = new Moderation(this.core)
    
    this.channels = {
      '!status': new VirtualChannelDetails("!status"),
    }
    this.chname = "!status"
    this.channel = this.chname // alias for commands. keep chname for backwards compat
    this.showIds = false
    
    this.name = ''
    this.topic = ''
    this.users = {} // public keys -> cabal-core use
    this.listeners = [] // keep track of listeners so we can remove them when we remove a cabal
    this.user = undefined
    this._initialize(done)
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
    this._emitUpdate("new-message", { 
        channel,
        author: this.users[message.key] || { key: message.key, name: message.key, local: false, online: false}, 
        message: Object.assign({}, message) 
    })
  }

  /**
   * Interpret a line of input from the user.
   * This may involve running a command or publishing a message to the current
   * channel.
   * @param {string} [line] input from the user
   * @param {function} [cb] callback called when the input is processed
   */
  processLine(line, cb) {
    var m = /^\/(\w+)(?:\s+(.*))?/.exec(line.trimRight())
    if (m && this._commands[m[1]] && typeof this._commands[m[1]].call === 'function') {
      this._commands[m[1]].call(this, this._res, m[2])
      this._emitUpdate("command", { command: m[1], arg: m[2] || '' })
    } else if (m && this._aliases[m[1]]) {
      var key = this._aliases[m[1]]
      if (this._commands[key]) {
        this._commands[key].call(this, this._res, m[2])
        this._emitUpdate("command", { command: key, arg: m[2] || ''})
      } else {
        this._res.info(`command for alias ${m[1]} => ${key} not found`)
        cb()
      }
    } else if (m) {
      this._res.info(`${m[1]} is not a command. type /help for commands`)
    } else if (this.chname !== '!status' && /\S/.test(line)) {
      // disallow typing to !status
      this.publishMessage({
        type: 'chat/text',
        content: {
          channel: this.chname,
          text: line.trimRight()
        }
      }, {}, cb)
    }
  }

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

  /**
   * Publish a message up to consumer. See 
   * [`cabal-core`](https://github.com/cabal-club/cabal-core/) 
   * for the full list of options.
   * @param {object} msg the full message object
   * @param {object} [opts] options passed down to cabal.publish
   * @param {function} [cb] callback function called when message is published
   * @example
   * cabalDetails.publishMessage({
   *   type: 'chat/text',
   *   content: {
   *     text: 'hello world',
   *     channel: 'cabal-dev'
   *   }
   * })
   */
  publishMessage(msg, opts, cb) {
    if (!cb) { cb = noop } 
    if (!msg.content.channel) {
      msg.content.channel = this.chname
    }
    if (!msg.type) msg.type = "chat/text"
      this.core.publish(msg, opts, (err, m) => {
          this._emitUpdate("publish-message", { message: msg })
          cb(err, m)
      })
  }

  /**
   * Announce a new nickname.
   * @param {string} nick 
   * @param {function} [cb] will be called after the nick is published
   */
  publishNick(nick, cb) {
    this.core.publishNick(nick, (err) => {
      if (err) return cb(err)
      this.user.name = nick
      this._emitUpdate("publish-nick", { name: nick })
      cb()
    })
  }

  /**
   * Publish a new channel topic to `channel`. 
   * @param {string} [channel=this.chname] 
   * @param {string} topic 
   * @param {function} cb will be called when publishing has finished.
   */
  publishChannelTopic(channel=this.chname, topic, cb) {
    this.core.publishChannelTopic(channel, topic, cb)
  }

  /**
   * @param {string} [channel=this.chname]
   * @returns {string} The current topic of `channel` as a string
   */
  getTopic(channel=this.chname) {
    return this.channels[channel].topic || ''
  }

  /**
   * Return the list of users that have joined `channel`. 
   * Note: this can be a subset of all of the users in a cabal.
   * @param {string} [channel=this.chname]
   * @returns {object[]}
   */
  getChannelMembers(channel=this.chname) {
    var details = this.channels[channel]
    if (!details) return []
    if (channel === "!status") return this.getUsers()
    return details.getMembers().map((ukey) => this.users[ukey]).filter((u) => u)
  }

  focusChannel(channel=this.chname, keepUnread=false) {
    let currentChannel = this.channels[this.chname]
    if (channel === currentChannel.name) return // don't focus the already focused channel
    if (currentChannel) {
      // mark previous as read
      if (!keepUnread) currentChannel.markAsRead()
      currentChannel.unfocus()
    }
    this.chname = channel
    this.channel = this.chname
    currentChannel = this.channels[channel]
    currentChannel.focus()
    this._emitUpdate("channel-focus", { channel })
  }

  unfocusChannel(channel=this.chname, newChannel) {
    this.channels[channel].unfocus()
    // open a new channel after closing `channel`
    if (newChannel) this.focusChannel(newChannel)
  }

  /**
   * Add a status message, visible locally only.
   * @param {object} message
   * @param {string} [channel=this.chname]
   */
  addStatusMessage(message, channel=this.chname) {
    if (!this.channels[channel]) return
    debug(channel)
    this.channels[channel].addVirtualMessage(message)
    this._emitUpdate("status-message", { channel, message })
  }

  /**
   * @returns {string[]} a list of all the channels in this cabal.
   */
  getChannels() {
    return Object.keys(this.channels).sort()
  }

  // returns a ChannelDetails object
  getChannel(channel=this.chname) {
    return this.channels[channel] 
  }
  /**
   * @returns {string} The name of the current channel
   */
  getCurrentChannel() {
      return this.chname
  }

  /**
   * @returns {ChannelDetails} A ChannelDetails object for the current chanel
   */
  getCurrentChannelDetails() {
      return this.channels[this.chname]
  }

  /**
   * Remove all of the virtual (i.e. status) messages associated with this channel. 
   * Virtual messages are local only.
   * @param {string} [channel=this.chname]
   */
  clearVirtualMessages(channel=this.chname) {
    return this.channels[channel].clearVirtualMessages()
  }

  /**
   * @returns {string[]} A list of all of the channel names the user has joined.
   */
  getJoinedChannels() {
    return Object.keys(this.channels).filter(c => this.channels[c].joined).sort()
  }
    
  /**
   * @returns {user} The local user for this cabal.
   */
  getLocalUser() {
    return this.user
  }

  /**
   * @returns {string} The local user's username (or their truncated public key, if their
   * username is not set)
   */
  getLocalName() {
      return this.user.name || this.user.key.slice(0,8)
  }
  
  /**
   * Join a channel. This is distinct from focusing a channel, as this actually tracks changes
   * and publishes a message announcing that you have joined the channel
   * @param {string} channel 
   */
  joinChannel(channel, cb) {
    if (!cb) cb = noop
    if (channel === '@' || /^!/.test(channel)) {
      return nextTick(cb, new Error('cannot join invalid channel name'))
    }
    var details = this.channels[channel]
    // we created a channel
    if (!details) {
        details = new ChannelDetails(this.core, channel)
        this.channels[channel] = details
    }
    // we weren't already in the channel, join
    if (!details.join()) { 
      var joinMsg = {
        type: "channel/join",
        content: { channel }
      }
      // publish a join message to the cabal to signify our presence
      this.core.publish(joinMsg, (err) => {
        if (err) return cb(err)
        // we probably always want to open a joined channel?
        this.focusChannel(channel)
        cb(null)
      })
    } else nextTick(cb, null)
  }

  /**
   * Leave a joined channel. This publishes a message announcing 
   * that you have left the channel.
   * @param {string} channel 
   */
  leaveChannel(channel, cb) {
    if (typeof channel === 'function') {
      cb = channel
      channel = this.chname
    } else if (!channel) {
      channel = this.chname
    }
    if (!cb) cb = noop
    if (channel === "!status") {
      return nextTick(cb, new Error('cannot leave the !status channel'))
    }
    var joined = this.getJoinedChannels()
    var details = this.channels[channel]
    if (!details) {
      return nextTick(cb, new Error('cannot leave a non-existent channel'))
    }
    var left = details.leave()
    // we were in the channel, leave
    if (left) { 
      var leaveMsg = {
        type: "channel/leave",
        content: { channel }
      }
      this.core.publish(leaveMsg, (err) => {
        if (err) return cb(err)
        var indexOldChannel = joined.indexOf(channel)
        var newChannel
        // open up another channel if we left the one we were viewing
        if (channel === this.chname) {
          let newIndex = indexOldChannel + 1
          if (indexOldChannel >= joined.length) newIndex = 0
          newChannel = joined[newIndex] || "!status"
        }
        this.unfocusChannel(channel, newChannel)
        cb(null)
      })
    }
  }

  /**
   * @returns {object} all of the users in this cabal. Each key is the public key of its 
   * corresponding user.
   */
  getUsers() {
    return Object.assign({}, this.users)
  }

  /**
   *
   * Fires when the cabal has finished initialization
   * @event CabalDetails#init
   */

  /**
   *
   * Fires when a user has updated their nickname
   * @event CabalDetails#user-updated
   * @type {object}
   * @property {string} key - Public key of the updated user
   * @property {object} user - Object containing user information 
   * @prop {string} user.name - Current nickname of the updated user
   */

  /**
   *
   * Fires when a new channel has been created
   * @event CabalDetails#new-channel
   * @type {object}
   * @property {string} channel - Name of the created channel
   */

  /**
   *
   * Fires when a new message has been posted
   * @event CabalDetails#new-message
   * @type {object}
   * @property {string} channel - Name of the channel the message was posted to
   * @property {object} author - Object containing the user that posted the message
   * @prop {string} author.name - Nickname of the user 
   * @prop {string} author.key - Public key of the user 
   * @prop {boolean} author.local - True if user is the local user (i.e. at the keyboard and not someone else in the cabal)
   * @prop {boolean} author.online - True if the user is currently online
   * @prop {object} message - The message that was posted. See `cabal-core` for more complete message documentation.
   * @prop {string} message.key - Public key of the user posting the message (again, it's a quirk)
   * @prop {number} message.seq - Sequence number of the message in the user's append-only log 
   * @prop {object} message.value - Message content, see `cabal-core` documentation for more information.
   *    
   */

  /**
   *
   * Fires when the local user has published a new message
   * @event CabalDetails#publish-message
   * @type {object}
   * @prop {object} message - The message that was posted. See `cabal-core` for more complete message documentation.
   * @prop {string} message.type - Message type that was posted, e.g. `chat/text` or `chat/emote` 
   * @prop {string} message.content - Message contents, e.g. channel and text if `chat/text`
   * @prop {number} message.timestamp - The time the message was published
   *    
   */
   
  /**
   *
   * Fires when the local user has published a new nickname
   * @event CabalDetails#publish-nick
   * @type {object}
   * @property {string} name - The nickname that was published
   */
   
  /**
   *
   * Fires when a status message has been created. These are only visible by the local user.
   * @event CabalDetails#status-message
   * @type {object}
   * @property {string} channel - Name of the channel the message was published to 
   * @prop {object} message
   * @prop {number} message.timestamp - Publish timestamp
   * @prop {string} message.text - The published status message contents
   */
   
  /**
   *
   * Fires when a new channel topic has been set
   * @event CabalDetails#topic
   * @type {object}
   * @property {string} channel - Name of the channel with the new topic
   * @property {string} topic - Name of the channel with the new topic
   */

  /**
   *
   * Fires when the user has focused (i.e. switched to) a new channel
   * @event CabalDetails#channel-focus
   * @type {object}
   * @property {string} channel - Name of the focused channel
   */

  /**
   *
   * Fires when a user has joined a channel
   * @event CabalDetails#channel-join
   * @type {object}
   * @property {string} channel - Name of the joined channel
   * @property {string} key - Public key of the user joining the channel
   * @property {boolean} isLocal - True if it was the local user joining a new channel
   */

  /**
   *
   * Fires when a user has leaveed a channel
   * @event CabalDetails#channel-leave
   * @type {object}
   * @property {string} channel - Name of the leaved channel
   * @property {string} key - Public key of the user leaving the channel
   * @property {boolean} isLocal - True if it was the local user leaving a new channel
   */

  /**
   *
   * Fires when another cabal has been focused
   * @event CabalDetails#cabal-focus
   * @type {object}
   * @property {string} key - Key of the focused cabal
   */

  /**
   *
   * Fires when the local user has connected directly with another peer
   * @event CabalDetails#started-peering
   * @type {object}
   * @property {string} key - Public key of the other peer
   * @property {string} name- Name of the other peer
   */

  /**
   *
   * Fires when the local user has disconnected with another peer
   * @event CabalDetails#stopped-peering
   * @type {object}
   * @property {string} key - Public key of the other peer
   * @property {string} name- Name of the other peer
   */

  
  /**
   *
   * Fires when any kind of change has happened to the cabal.
   * @event CabalDetails#update
   */

  _emitUpdate(type, payload=null) {
    this.emit('update', this)
    if (type) {
        if (payload) { debug("%s %o", type, payload) }
        else { debug("%s", type) }
        this.emit(type, payload)
    } else {
        debug("update (no assigned type)")
    }
  }

  registerListener(source, event, listener) {
    this.listeners.push({ source, event, listener })
    source.on(event, listener)
  }

  /**
   * Destroy all of the listeners associated with this `details` instance
   */
  _destroy (cb) {
    cb = cb || noop
    this.listeners.forEach((obj) => { obj.source.removeListener(obj.event, obj.listener)})
    this.core.close(() => {
      this.core.db.close(cb)
    })
  }

  _initializeLocalUser(done) {
    this.core.getLocalKey((err, lkey) => {
      if (err) return done(err)
      this.user = new User()
      this.user.key = lkey
      this.user.local = true
      this.user.online = true
      this.users[lkey] = this.user
      // try to get more data for user
      this.core.users.get(lkey, (err, user) => {
        if (err || !user) { 
            this._emitUpdate("init")
            done(null)
            return
        }
        this.user = new User(user)
        // restore `user.local` and `user.online` as they don't come from cabal-core
        this.user.key = lkey
        this.user.local = true
        this.user.online = true
        this.users[lkey] = this.user
        this._emitUpdate("init") // TODO: revise this event (is it the final init?)
        done(null)
      })
    })
  }

  _initialize(done) {
    const cabal = this.core
    // populate channels
    cabal.channels.get((err, channels) => {
      channels.forEach((channel) => {
        let details = this.channels[channel]
        if (!details) {
          this.channels[channel] = new ChannelDetails(cabal, channel)
        }
        // listen for updates that happen within the channel
        cabal.messages.events.on(channel, this.messageListener.bind(this))

        // add all users joined to a channel
        cabal.memberships.getUsers(channel, (err, users) => {
          users.forEach((u) => this.channels[channel].addMember(u))
        })

        // for each channel, get the topic
        cabal.topics.get(channel, (err, topic) => {
          this.channels[channel].topic = topic || ''
        })
      })
    })

    cabal.getLocalKey((err, lkey) => {
      cabal.memberships.getMemberships(lkey, (err, channels) => {
        if (channels.length === 0) {
          // make `default` the first channel if no saved state exists
          this.joinChannel('default')
        }
        for (let channel of channels) { 
          // it's possible to be joined to a channel that `cabal.channels.get` doesn't return
          // (it's an empty channel, with no messages)
          let details = this.channels[channel]
          if (!details) {
            this.channels[channel] = new ChannelDetails(cabal, channel)
            // listen for updates that happen within the channel
            cabal.messages.events.on(channel, this.messageListener.bind(this))
          }
          this.channels[channel].joined = true
        }
      // this._emitUpdate() -- TODO: commented this generic event out, if things break then reinstate it. otherwise remove before merge
      })
    })

    // notify when a user has joined a channel
    this.registerListener(cabal.memberships.events, 'add', (channel, user) => {
      if (!this.channels[channel]) { 
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].addMember(user)
      this._emitUpdate("channel-join", { channel, key: user, isLocal: user === this.user.key })
    })

    // notify when a user has left a channel
    this.registerListener(cabal.memberships.events, 'remove', (channel, user) => {
      if (!this.channels[channel]) { 
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].removeMember(user)
      this._emitUpdate("channel-leave", { channel, key: user, isLocal: user === this.user.key })
    })

    // register to be notified of new channels as they are created
    this.registerListener(cabal.channels.events, 'add', (channel) => {
      let details = this.channels[channel]
      if (!details) {
        this.channels[channel] = new ChannelDetails(cabal, channel)
      }
      // TODO: only do this for our joined channels, instead of all channels
      // Calls fn with every new message that arrives in channel.
      cabal.messages.events.on(channel, this.messageListener.bind(this))
      this._emitUpdate("new-channel", { channel })
    })

    // Load moderation state
    const loadModerationState = (cb) => {
	  const promises = [this.moderation.getAdmins(), this.moderation.getMods()]
	  // get all moderation actions issued by our current mods & admins
	  Promise.all(promises).then(results => {
		const keys = results[0].concat(results[1])
		keys.forEach(key => {
		  const write = (row, enc, next) => {
			if (!row) return
			const name = this.users[key].name || key.slice(0, 8)
			const target = this.users[row.content.id].name || row.content.id.slice(0, 8)
			const action = row.type.split("/")[1]
			const reason = row.content.reason
			const role = row.content.flags[0]
			const text = `${name} ${action === "remove" ? "removed" : "added"} ${target} as ${role} ${reason ? "reason: " + reason : ''}`
			this.addStatusMessage({ text, timestamp: row.timestamp })
			next()
		  }
		  const end = (next) => { next() }
		  pump(this.core.moderation.listModerationBy(key), to.obj(write, end))
		})
      })
      cabal.moderation.list((err, list) => {
        if (err) return cb(err)
        list.forEach(info => {
          const user = this.users[info.id]
          if (user) user.flags.set(info.channel, info.flags)
        })
        cb()
      })
    }

    cabal.users.getAll((err, users) => {
      if (err) return
      this.users = new Map()
      Object.keys(users).forEach(key => {
        this.users[key] = new User(users[key])
	  })
	  this._initializeLocalUser(() => {
		loadModerationState(() => {
		  this.registerListener(cabal.moderation.events, 'update', (info) => {
			let user = this.users[info.id]
			let changedRole = {}
			if (!user) {
			  const flags = new Map()
			  flags.set(info.group, info.flags)
			  user = new User({key:info.id, flags: flags})
			  this.users[info.id] = user
			} else {
			  changedRole = { mod: user.isModerator(), admin: user.isAdmin(), hidden: user.isHidden() }
			  user.flags.set(info.group, info.flags)
			  changedRole.mod = changedRole.mod != user.isModerator()
			  changedRole.admin = changedRole.admin != user.isAdmin()
			  changedRole.hidden = changedRole.hidden != user.isHidden()
			}
			const issuer = this.users[info.by]
			// don't print message if:
			// * it is our own action (we already log that locally)
			// * if the issuer wasn't one of our mods/admins
			if (issuer.key === this.user.key || (!issuer.isModerator() && !issuer.isAdmin())) return 
			this.core.getMessage(info.key, (err, doc) => {
			  const issuerName = issuer.name || info.by.slice(0, 8)
			  const role = doc.content.flags[0]
			  const reason = doc.content.reason.? `(reason: ${doc.content.reason})` : ''
			  // there was no change in behaviour, e.g. someone modded an already
			  // modded person, hid someone that was already hidden
			  const changeOccurred = Object.keys(changedRole).filter(r => changedRole[r]).length > 0
			  if (!changeOccurred) { 
				this._emitUpdate("user-updated", { key: info.id, user })
				return
			  }
			  const type = doc.type.replace(/^flags\//, '')
			  let action, text
			  if (["admin", "mod"].includes(role)) { action = (type === "add" ? "added" : "removed") }
			  if (role === "hide") { action = (type === "add" ? "hid" : "unhid") }
			  if (role === "hide")  {
				text = `${issuerName} ${action} ${user.name} ${reason}`
			  } else {
				text = `${issuerName} ${action} ${user.name} as ${role} ${reason}`
			  }
			  this._emitUpdate("user-updated", { key: info.id, user })
			  this.addStatusMessage({ text }, "!status")
			})
		  })
		  done()
		})
	  })

      this.registerListener(cabal.users.events, 'update', (key) => {
        cabal.users.get(key, (err, user) => {
          if (err) return
          this.users[key] = new User(Object.assign(this.users[key] || {}, user))
          if (this.user && key === this.user.key) this.user = this.users[key]
          this._emitUpdate("user-updated", { key, user })
        })
      })

      this.registerListener(cabal.topics.events, 'update', (msg) => {
          var { channel, text } = msg.value.content
          if (!this.channels[channel]) { this.channels[channel] = new ChannelDetails(this.core, channel) }
          this.channels[channel].topic = text || ''
          this._emitUpdate("topic", { channel, topic: text || ''})
      })

      this.registerListener(cabal, 'peer-added', (key) => {
        if (this.users[key]) {
          this.users[key].online = true
        } else {
          this.users[key] = new User({ key, online: true })
        }
        this._emitUpdate("started-peering", { key, name: this.users[key].name || key })
      })

      this.registerListener(cabal, 'peer-dropped', (key) => {
        Object.keys(this.users).forEach((k) => {
          if (k === key) {
            this.users[k].online = false
          }
        })
        this._emitUpdate("stopped-peering", { key, name: this.users[key].name || key })
      })
    }) 
  }
}

function noop () {}

module.exports = CabalDetails
