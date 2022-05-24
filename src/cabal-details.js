const EventEmitter = require('events')
const Cabal = require('cabal-core')
const debug = require('debug')('cabal-client')
const { VirtualChannelDetails, ChannelDetails, PMChannelDetails } = require('./channel-details')
const User = require('./user')
const to = require('to2')
const pump = require('pump')
const Moderation = require('./moderation')
const timestamp = require('monotonic-timestamp')
const collect = require('collect-stream')
const init = require('./initialization-callbacks')
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
   * @fires CabalDetails#info
   * @fires CabalDetails#user-updated
   * @fires CabalDetails#new-channel
   * @fires CabalDetails#new-message
   * @fires CabalDetails#private-message
   * @fires CabalDetails#publish-message
   * @fires CabalDetails#publish-private-message
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
  constructor ({ cabal, client, commands, aliases }, done) {
    super()
    this._cabal = cabal
    this.core = cabal
    this.client = client
    this._commands = commands || {}
    this._aliases = aliases || {}
    /* _res takes a command (cabal event type, a string) and returns an object with the functions: info, error, end */
    this._res = function (command) { // command: the type of event emitting information (e.g. channel-join, new-message, topic etc)
      let seq = 0 // tracks # of sent info messages
      const uid = `${timestamp()}` // id uniquely identifying this stream of events
      return {
        info: (msg, obj) => {
          let payload = (typeof msg === "string") ? { text: msg } : { ...msg }
          if (typeof obj !== "undefined") payload = { ...payload, ...obj }
          payload["meta"] = { uid, command, seq: seq++ }

          this._emitUpdate('info', payload)
        },
        error: (err) => {
          this._emitUpdate('error', err)
        },
        end: () => {
          // emits an event to indicate the command has finished 
          this._emitUpdate('end', { uid, command, seq })
        }
      }
    }
    this.key = cabal.key
    this.moderation = new Moderation(this.core)

    this.channels = {
      '!status': new VirtualChannelDetails('!status')
    }
    this.chname = '!status'
    this.channel = this.chname // alias for commands. keep chname for backwards compat
    this.showIds = false

    this.name = ''
    this.topic = ''
    this.users = {} // public keys -> cabal-core use
    this.listeners = [] // keep track of listeners so we can remove them when we remove a cabal
    this.user = undefined
    this.settings = client.getCabalSettings(this.key)
    this._initialize(done)
  }

  _handleMention (message) {
    if (message.value.type !== 'chat/text') return null
    const name = this.user.name || this.user.key.slice(0, 8)
    const line = message.value.content.text.trim()
    // a direct mention is if you're mentioned at the start of the message
    // an indirect (or not direct) mention is if you're mentioned somewhere in the message
    const directMention = (line.slice(0, name.length) === name)
    message.directMention = directMention
    return line.includes(name) ? message : null
  }

  messageListener (message) {
    let channel = message.value.content.channel
    const mention = this._handleMention(message)
    if (message.value.private) {
      const isPrivate = message.value.private
      if (isPrivate || isPrivate === "true") {
        // PM channel should always be that of the pubkey that we are chatting with
        // (and not our own pubkey—unless we are chattin with ourselves, bien sûr)
        channel = this.user.key === message.key ? channel : message.key
        const details = this.channels[channel]
        if (!details) { // incoming PM & no pm channel?! instantiate a pm channel asap!
          this.channels[channel] = new PMChannelDetails(this, this.core, channel)
          // join it by default (separate setting to control this behaviour to be introduced)
          this.joinPrivateMessage(channel)
        }
        this._emitUpdate('private-message', {
          channel,
          author: this.users[message.key] || { key: message.key, name: message.key, local: false, online: false },
          message: Object.assign({}, message)
        })
      }
    }

    this.channels[channel].handleMessage(message)
    if (mention) this.channels[channel].addMention(message)

    this._emitUpdate('new-message', {
      channel,
      author: this.users[message.key] || { key: message.key, name: message.key, local: false, online: false },
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
  processLine (line, cb) {
    if (!cb) { cb = noop }
    var m = /^\/\s*(\w+)(?:\s+(.*))?/.exec(line.trimRight())
    if (m && this._commands[m[1]] && typeof this._commands[m[1]].call === 'function') {
      this._commands[m[1]].call(this, this._res(m[1]), m[2])
    } else if (m && this._aliases[m[1]]) {
      var key = this._aliases[m[1]]
      if (this._commands[key]) {
        this._commands[key].call(this, this._res(key), m[2])
      } else {
        this._res("warn").info(`command for alias ${m[1]} => ${key} not found`)
        cb()
      }
    } else if (m) {
      this._res("warn").info(`${m[1]} is not a command. type /help for commands`)
    } else if (this.chname !== '!status' && /\S/.test(line)) { // disallow typing to !status
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
  publishMessage (msg, opts, cb) {
    if (!cb) { cb = noop }
    if (!msg.content.channel) {
      msg.content.channel = this.chname
    }
    // no typing to !status
    if (msg.content.channel === "!status") return cb(new Error("not allowed to post to !status"), null) 
    if (!msg.type) msg.type = 'chat/text'

    // detect if published-to channel is private, if so change message type & redirect contents 
    // rationale: we're trying to catch cases where a PM is incorrectly being sent to a public channel
    // (i.e. msg.content.channel === a user's pubkey; dis bad, might even be malicious)
    //
    // note: the latter conditional guards against someone maliciously trying to create a channel conforming
    // to an existing-but-not-synced-on-the-local-client public key; implicitly, we now treat all channel names that conform to the public key
    // format (64ch hex) as private message channels
    if (this.isChannelPrivate(msg.content.channel) || Cabal.isHypercoreKey(msg.content.channel)) {
      return this._redirectAsPrivateMessage(msg, opts, cb)
    }
    this.core.publish(msg, opts, (err, m) => {
      this._emitUpdate('publish-message', { message: msg })
      cb(err, m)
    })
  }

  /**
   * Announce a new nickname.
   * @param {string} nick
   * @param {function} [cb] will be called after the nick is published
   */
  publishNick (nick, cb) {
    if (!cb) { cb = noop }
    this.core.publishNick(nick, (err) => {
      if (err) return cb(err)
      this.user.name = nick
      this._emitUpdate('publish-nick', { name: nick })
      cb()
    })
  }

  /**
   * Publish a new channel topic to `channel`.
   * @param {string} [channel=this.chname]
   * @param {string} topic
   * @param {function} cb will be called when publishing has finished.
   */
  publishChannelTopic (channel = this.chname, topic, cb) {
    if (!cb) { cb = noop }
    // make sure we don't publish topic messages for PMs
    if (this.channels[channel] && this.channels[channel].isPrivate) {
      // TODO (2021-11-17): for the future, look into setting up a pipeline for handling topics on encrypted/PM channels
      return nextTick(cb, new Error("setting topics on PMs is currently not enabled—sorry!"))
    }
    this.core.publishChannelTopic(channel, topic, cb)
  }

  /**
   * @param {string} [channel=this.chname]
   * @returns {string} The current topic of `channel` as a string
   */
  getTopic (channel = this.chname) {
    return this.channels[channel].topic || ''
  }

  /**
   * Return the list of users that have joined `channel`.
   * Note: this can be a subset of all of the users in a cabal.
   * @param {string} [channel=this.chname]
   * @returns {object[]}
   */
  getChannelMembers (channel = this.chname) {
    var details = this.channels[channel]
    if (!details) return []
    if (channel === '!status') return this.getUsers()
    return details.getMembers().map((ukey) => this.users[ukey]).filter((u) => u)
  }

  focusChannel (channel = this.chname, keepUnread = false) {
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
    // mark new channel as read
    if (!keepUnread) currentChannel.markAsRead()
    currentChannel.focus()
    this._emitUpdate('channel-focus', { channel })
  }

  unfocusChannel (channel = this.chname, newChannel) {
    this.channels[channel].unfocus()
    // open a new channel after closing `channel`
    if (newChannel) this.focusChannel(newChannel)
  }

  /**
   * Add a status message, visible locally only.
   * @param {object} message
   * @param {string} [channel=this.chname]
   */
  addStatusMessage (message, channel = this.chname) {
    if (!this.channels[channel]) return
    debug(channel)
    this.channels[channel].addVirtualMessage(message)
    this._emitUpdate('status-message', { channel, message })
  }

  /**
   * @param {object} [opts]
   * @property {boolean} includeArchived - Determines whether to include archived channels or not. Defaults to false.
   * @property {boolean} includePM - Determines whether to include private message channels or not. Defaults to false.
   * @property {boolean} onlyJoined - Determines whether to limit returned channels to only those that are joined or not. Defaults to false.
   * @returns {string[]} a list of all the channels in this cabal. Does not return channels with 0 members.
   */
  getChannels (opts) {
    if (!opts || typeof opts !== "object" || opts[Symbol.iterator]) { 
      opts = { includeArchived: false, includePM: false, onlyJoined: false}
    }
    // sort regular channels and PMs separately, then concat them together (if including PM) before returning
    const sortedChannels = Object.keys(this.channels)
      .filter(ch => 
        ch != "!status" /* exclude status, it's included later */
        && this.channels[ch].members.size > 0 
        && (!this.channels[ch].isPrivate)
        && (opts.includeArchived || !this.channels[ch].archived)
        && (!opts.onlyJoined || opts.onlyJoined && this.channels[ch].joined)
      )
      .sort()
    // get all PMs with non-hidden users && sort them
    const sortedPMs = Object.keys(this.channels)
      .filter(ch => this.channels[ch].isPrivate && this.channels[ch].joined && !this.users[ch].isHidden())
      .sort()
    return Array.prototype.concat(["!status"], opts.includePM ? sortedPMs : [], sortedChannels)
  }

  // returns a ChannelDetails object
  getChannel (channel = this.chname) {
    return this.channels[channel]
  }

  /**
   * @returns {string} The name of the current channel
   */
  getCurrentChannel () {
    return this.chname
  }

  /**
   * @returns {ChannelDetails} A ChannelDetails object for the current chanel
   */
  getCurrentChannelDetails () {
    return this.channels[this.chname]
  }

  /**
   * Remove all of the virtual (i.e. status) messages associated with this channel.
   * Virtual messages are local only.
   * @param {string} [channel=this.chname]
   */
  clearVirtualMessages (channel = this.chname) {
    return this.channels[channel].clearVirtualMessages()
  }

  /**
   * Get the list of currently opened private message channels.
   * @returns{string[]} A list of all public keys you have an open PM with (hidden users are removed from list).
   */
  getPrivateMessageList () {
    return Object.keys(this.channels).filter(ch => this.channels[ch].isPrivate && (ch in this.users && !this.users[ch].isHidden()))
  }

  /**
   * Query if the passed in channel name is private or not
   * @returns{boolean} true if channel is private, false if not (or if it doesn't exist)
   */
  isChannelPrivate (channel) {
    const details = this.channels[channel]
    if (!details) { return false }
    return details.isPrivate
  }

  /**
   * Join a private message channel if it is not already joined.
   * @param {string} channel the key of the PM to join
   */
  joinPrivateMessage (channel) {
    this.settings.joinedPrivateMessages.push(channel)
    this.settings.joinedPrivateMessages = Array.from(new Set(this.settings.joinedPrivateMessages)) // dedupe array entries
    this.client.writeCabalSettings(this.key, this.settings)
  }

  /**
   * Leave a private message channel if it has not already been left.
   * @param {string} channel the key of the PM to leave
   */
  leavePrivateMessage (channel) {
    if (this.settings.joinedPrivateMessages.includes(channel)) {
      // Remove the private message from the joined setting
      this.settings.joinedPrivateMessages = this.settings.joinedPrivateMessages.filter((pm) => pm !== channel)
    }
    this.client.writeCabalSettings(this.key, this.settings)
  }

  // redirects private messages posted via cabalDetails.publishMessage()
  _redirectAsPrivateMessage (msg, opts, cb) {
    const recipient = msg.content.channel
    switch (msg.type) {
      case "chat/emote":
      case "chat/text":
        // these types are definitely supported : )
        break
      default:
        debug("redirectAsPM received msg type", msg.content.type)
        return cb(new Error("private messages currently lacks support for message type: " + msg.type))
        break
    }
    this.publishPrivateMessage(msg, recipient, cb)
  }
  /**
   * Send a private message to a recipient. Open and focus a new private message channel if one doesn't exist already.
   * @param {string} msg - a message object conforming to any type of chat message  (e.g. `chat/text` or `chat/emote`),
   * see CabalDetails.publishMessage for more information
   * @param {string} recipientKey - the public key of the recipient
   * @param {function} [cb] - optional callback triggered after trying to publish (returns err if failed)
   */
  publishPrivateMessage (msg, recipientKey, cb) {
    if (!cb) cb = noop
    // validate that the recipientKey exactly matches the requirements imposed on user public keys
    if (!Cabal.isHypercoreKey(recipientKey)) {
      return cb(new Error("tried to publish a private message to a key that does not match the public key format"))
    }
    // check to see make sure we know of a user with recipientKey
    if (!recipientKey in this.users) {
      return cb(new Error("tried to publish a private message to unknown public key"))
    }
    let pmInstance = this.channels[recipientKey]
    // check to see if we have opened a pm with this person before
    if (!pmInstance) {
      // if not: add a new PMChannelDetails instance to channels
      this.channels[recipientKey] = new PMChannelDetails(this, this.core, recipientKey)
    }
    // focus it if we're opening a new PM (or reopening a previously closed instance)
    if (!pmInstance.joined) {
      this.focusChannel(recipientKey)
      this.joinPrivateMessage(recipientKey)
    }
    if (!pmInstance.isPrivate) { // pm channel is not an actual pm instance! this should probably never happen, though
      return cb(new Error("tried to publish a private message to a non-private message channel"))
    }

    // publish message to cabal-core, where it will be encrypted
    this.core.publishPrivate(msg, recipientKey, (err) => {
      // publishing failed somehow
      if (err) {
        return cb(err)
      }
      this._emitUpdate('publish-private-message', { ...msg })
      cb()
    })
  }

  /**
   * @returns {string[]} A list of all of the channel names the user has joined. Excludes private message channels.
   */
  getJoinedChannels () {
    return Object.keys(this.channels).filter(c => this.channels[c].joined && !this.channels[c].isPrivate).sort()
  }

  /**
   * @returns {user} The local user for this cabal.
   */
  getLocalUser () {
    return this.user
  }

  /**
   * @returns {string} The local user's username (or their truncated public key, if their
   * username is not set)
   */
  getLocalName () {
    return this.user.name || this.user.key.slice(0, 8)
  }

  /**
   * Join a channel. This is distinct from focusing a channel, as this actually tracks changes
   * and publishes a message announcing that you have joined the channel
   * @param {string} channel
   */
  joinChannel (channel, cb) {
    if (!cb) cb = noop
    if (channel === '@' || /^!/.test(channel)) {
      return nextTick(cb, new Error('cannot join invalid channel name'))
    }
    var details = this.channels[channel]
    // disallow joining a channel that is exactly another peer's public key
    if ((details && details.isPrivate) || Cabal.isHypercoreKey(channel)) {
      if (details && details.isPrivate) {
        // the private message already exists, rejoin it
        this.joinPrivateMessage(details.recipient)
        return nextTick(cb, null)
      } else {
        return nextTick(cb, new Error("tried to join a new private message channel (start a pm using /pm <name>)"))
      }
    }
    // we created a channel
    if (!details) {
      details = new ChannelDetails(this.core, channel)
      this.channels[channel] = details
    }

    // we weren't already in the channel, join
    if (!details.join()) {
      var joinMsg = {
        type: 'channel/join',
        content: { channel }
      }
      // publish a join message to the cabal to signify our presence
      this.core.publish(joinMsg, (err) => {
        if (err) return cb(err)
        // we probably always want to open a joined channel?
        this.focusChannel(channel)
        return cb(null)
      })
    } else nextTick(cb, null)
  }

  /**
   * Leave a joined channel. This publishes a message announcing
   * that you have left the channel.
   * @param {string} channel
   */
  leaveChannel (channel, cb) {
    if (!cb) { cb = noop }
    if (typeof channel === 'function') {
      cb = channel
      channel = this.chname
    } else if (!channel) {
      channel = this.chname
    }
    if (channel === '!status') {
      return nextTick(cb, new Error('cannot leave the !status channel'))
    }
    if ((details && details.isPrivate) || Cabal.isHypercoreKey(channel)) {
      this.leavePrivateMessage(channel)
      // switch back to the !status channel after leaving
      this.unfocusChannel(channel, '!status')
      cb(null)
      return
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
        type: 'channel/leave',
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
        newChannel = joined[newIndex] || '!status'
      }
      this.unfocusChannel(channel, newChannel)
      cb(null)
      })
    }
  }

  /**
   * Archive a channel. Publishes a message announcing
   * that you have archived the channel, applying it to the views of others who have you as a moderator/admin.
   * @param {string} channel
   * @param {string} [reason]
   * @param {function} cb(err) - callback invoked when the operation has finished, with error as its only parameter
   */
  archiveChannel (channel, reason = "", cb) {
    if (!cb) cb = noop
    const details = this.channels[channel]

    if (channel === '!status') {
      const err = new Error('cannot archive the !status channel')
      debug(err)
      return nextTick(cb, err)
    }
    if (!details) {
      const err = new Error('cannot archive non-existent channel')
      debug(err)
      return nextTick(cb, err)
    }
    if (details.isPrivate) {
      return nextTick(cb, new Error('cannot archive private message channels'))
    }
    this.channels[channel].archive()
    this.publishMessage({
      type: 'channel/archive',
      content: {
        channel,
        reason
      }
    }, {}, cb)
  }

  /**
   * Unarchive a channel. Publishes a message announcing
   * that you have unarchived the channel.
   * @param {string} channel
   * @param {string} [reason]
   * @param {function} cb(err) - callback invoked when the operation has finished, with error as its only parameter
   */
  unarchiveChannel (channel, reason = "", cb) {
    if (!cb) cb = noop
    const details = this.channels[channel]

    if (channel === '!status') {
      const err = new Error('cannot unarchive the !status channel')
      debug(err)
      return nextTick(cb, err)
    }
    if (!details) {
      const err = new Error('cannot unarchive non-existent channel')
      debug(err)
      return nextTick(cb, err)
    }
    if (details.isPrivate) {
      return nextTick(cb, new Error('cannot archive or unarchive private message channels'))
    }
    this.channels[channel].unarchive()
    this.publishMessage({
      type: 'channel/unarchive',
      content: {
        channel,
        reason
      }
    }, {}, cb)
  }

  isChannelArchived(channel) {
    if (!this.channels[channel]) return false
    return this.channels[channel].archived
  }

  /**
   * @returns {object} all of the users in this cabal. Each key is the public key of its
   * corresponding user.
   */
  getUsers () {
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
   * Fires when a new private message has been posted
   * @event CabalDetails#private-message
   * @type {object}
   * @property {string} channel - The public key corresponding to the private message channel 
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
   * Fires when the local user has published a new private message
   * @event CabalDetails#publish-private-message
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

  /**
   *
   * Fires when a valid slash-command (/<command>) emits output. See src/commands.js for all commands & their payloads.
   * @event CabalDetails#info
   * @type {object}
   * @property {string} command - The command that triggered the event & has emitted output
   */

  _emitUpdate (type, payload = null) {
    this.emit('update', this)
    if (type) {
      if (payload) { debug('%s %o', type, payload) } else { debug('%s', type) }
      this.emit(type, payload)
    } else {
      debug('update (no assigned type)')
    }
  }

  registerListener (source, event, listener) {
    this.listeners.push({ source, event, listener })
    source.on(event, listener)
  }

  /**
   * Destroy all of the listeners associated with this `details` instance
   */
  _destroy (cb) {
    if (!cb) cb = noop
    this.listeners.forEach((obj) => { obj.source.removeListener(obj.event, obj.listener) })
    this.core.close(() => {
      this.core.db.close(cb)
    })
  }

  _initializeLocalUser (cb) {
    if (!cb) cb = noop
    this.core.getLocalKey((err, lkey) => {
      if (err) return cb(err)
      this.user = new User()
      this.user.key = lkey
      this.user.local = true
      this.user.online = true
      this.users[lkey] = this.user
      // try to get more data for user
      this.core.users.get(lkey, (err, user) => {
        if (err || !user) {
          cb(null)
          return
        }
        this.user = new User(user)
        // restore `user.local` and `user.online` as they don't come from cabal-core
        this.user.key = lkey
        this.user.local = true
        this.user.online = true
        this.users[lkey] = this.user
        cb(null)
      })
    })
  }

  _initialize (done) {
    const cabal = this.core
    let finished = 0
    let asyncBlocks = 0

    this._finish = () => {
      finished += 1
      if (finished >= asyncBlocks) done()
    }

    const invoke = (self, fn, cb) => {
      asyncBlocks += 1
      // the line below converts (as an example): 
      //    invoke(cabal.archives, "get", init.getArchivesCallback)
      // into: 
      //    cabal.archives.get(getArchivesCallback)
      // with proper `this` arguments for the respectively called functions
      self[fn].bind(self)(cb.bind(this))
    }

    /* invoke one-time functions to populate & initialize the local state from data on disk */
    invoke(cabal.archives, "get", init.getArchivesCallback)
    invoke(cabal, "getLocalKey", init.getLocalKeyCallback)
    invoke(cabal.users, "getAll", init.getAllUsersCallback)
    invoke(cabal.privateMessages, "list", init.getOpenedPMs)

    /* register all the listeners we'll be using */
    this.registerListener(cabal.users.events, 'update', (key) => {
      cabal.users.get(key, (err, user) => {
        if (err) return
        this.users[key] = new User(Object.assign(this.users[key] || {}, user))
        if (this.user && key === this.user.key) this.user = this.users[key]
        this._emitUpdate('user-updated', { key, user })
      })
    })

    this.registerListener(cabal.topics.events, 'update', (msg) => {
      var { channel, text } = msg.value.content
      if (!this.channels[channel]) { this.channels[channel] = new ChannelDetails(this.core, channel) }
      this.channels[channel].topic = text || ''
      this._emitUpdate('topic', { channel, topic: text || '' })
    })

    this.registerListener(cabal, 'peer-added', (key) => {
      if (this.users[key]) {
        this.users[key].online = true
      } else {
        this.users[key] = new User({ key, online: true })
      }
      this._emitUpdate('started-peering', { key, name: this.users[key].name || key })
    })

    this.registerListener(cabal, 'peer-dropped', (key) => {
      Object.keys(this.users).forEach((k) => {
        if (k === key) {
          this.users[k].online = false
        } 
      })
      this._emitUpdate('stopped-peering', { key, name: this.users[key].name || key })
    })

    // notify when a user has archived a channel
    this.registerListener(cabal.archives.events, 'archive', (channel, reason, key) => {
      const user = this.users[key]
      const isLocal = key === this.user.key 
      if (!isLocal && (!user || !user.canModerate())) { return }
      if (!this.channels[channel]) {
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].archive()
      this._emitUpdate('channel-archive', { channel, reason, key, isLocal })
    })

    // notify when a user has restored an archived channel
    this.registerListener(cabal.archives.events, 'unarchive', (channel, reason, key) => {
      const user = this.users[key]
      const isLocal = key === this.user.key 
      if (!isLocal && (!user || !user.canModerate())) { return }
      if (!this.channels[channel]) {
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].unarchive()
      this._emitUpdate('channel-unarchive', { channel, reason, key, isLocal })
    })

    // notify when a user has joined a channel
    this.registerListener(cabal.memberships.events, 'add', (channel, user) => {
      if (!this.channels[channel]) {
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].addMember(user)
      this._emitUpdate('channel-join', { channel, key: user, isLocal: user === this.user.key })
    })

    // notify when a user has left a channel
    this.registerListener(cabal.memberships.events, 'remove', (channel, user) => {
      if (!this.channels[channel]) {
        this.channels[channel] = new ChannelDetails(this.core, channel)
      }
      this.channels[channel].removeMember(user)
      this._emitUpdate('channel-leave', { channel, key: user, isLocal: user === this.user.key })
    })

    // register to be notified of new channels as they are created
    this.registerListener(cabal.channels.events, 'add', (channel) => {
      const details = this.channels[channel]
      if (!details && !Cabal.isHypercoreKey(channel)) {
        this.channels[channel] = new ChannelDetails(cabal, channel)
      }
      // TODO: only do this for our joined channels, instead of all channels
      // Calls fn with every new message that arrives in channel.
      cabal.messages.events.on(channel, this.messageListener.bind(this))
      this._emitUpdate('new-channel', { channel })
    })
  }
}

function noop () {}

module.exports = CabalDetails
