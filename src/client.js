const Cabal = require('cabal-core')
const CabalDetails = require('./cabal-details')
const collect = require('collect-stream')
const crypto = require('hypercore-crypto')
const DatDns = require('dat-dns')
const ram = require('random-access-memory')
const memdb = require('memdb')
const polyraf = require("polyraf")
const level = require('level')
const path = require('path')
const mkdirp = require('mkdirp')
const os = require('os')
const defaultCommands = require('./commands')
const paperslip = require("paperslip")

class Client {
  /**
   * Create a client instance from which to manage multiple
   * [`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.
   * @constructor
   * @param {object} [opts]
   * @param {object} opts.config
   * @param {boolean} opts.config.temp if `temp` is true no data is persisted to disk.
   * @param {string} [opts.config.dbdir] the directory to store the cabal data
   * @param {string} [opts.config.preferredPort] the port cabal will listen on for traffic
   * @param {number} [opts.maxFeeds=1000] max amount of feeds to sync
   * @param {object} [opts.persistentCache] specify a `read` and `write` to create a persistent DNS cache
   * @param {function} opts.persistentCache.read async cache lookup function
   * @param {function} opts.persistentCache.write async cache write function
   */
  constructor (opts) {
    if (!(this instanceof Client)) return new Client(opts)
    if (!opts) {
      opts = {
        config: {
          temp: true,
          dbdir: null,
          preferredPort: 0  // use cabal-core's default port
        }
      }
    }
    // This is redundant, but we might want to keep the cabal map around
    // in the case the user has access to cabal instances
    this._keyToCabal = {}
    // maps a cabal-core instance to a CabalDetails object
    this.cabals = new Map()
    this.currentCabal = null
    this.config = opts.config
    this.maxFeeds = opts.maxFeeds || 1000
    this.aliases = opts.aliases || {}
    this.commands = Object.assign({}, defaultCommands, opts.commands)
    Object.keys(this.commands).forEach(key => {
      ;(this.commands[key].alias || []).forEach(alias => {
        this.aliases[alias] = key
      })
    })

    const cabalDnsOpts = {
      hashRegex: /^[0-9a-f]{64}?$/i,
      recordName: 'cabal',
      protocolRegex: /^(cabal:\/\/[0-9A-Fa-f]{64}\b.*)/i,
      txtRegex: /^"?cabalkey=(cabal:\/\/[0-9A-Fa-f]{64}\b.*)"?$/i
    }
    // also takes opts.persistentCache which has a read and write function
    //   read: async function ()   // aka cache lookup function
    //   write: async function ()  // aka cache write function
    if (opts.persistentCache) cabalDnsOpts.persistentCache = opts.persistentCache
    this.cabalDns = DatDns(cabalDnsOpts)
  }

  /**
   * Get the current database version.
   * @returns {string}
   */
  static getDatabaseVersion () {
    return Cabal.databaseVersion
  }

  /**
   * Returns a 64 character hex string i.e. a newly generated cabal key.
   * Useful if you want to programmatically create a new cabal as part of a shell pipeline.
   * @returns {string}
   */
  static generateKey () {
    return crypto.keyPair().publicKey.toString('hex')
  }

  /**
   * Removes URI scheme, URI search params (if present), and returns the cabal key as a 64 character hex string
   * @param {string} key the key to scrub
   * @returns {string} the scrubbed key
   * @example
   * Client.scrubKey('cabal://12345678...?admin=7331b4b..')
   * // => '12345678...'
   */
  static scrubKey (key) {
      // remove url search params; indexOf returns -1 if no params => would chop off the last character if used w/ slice
      if (key.indexOf("?") >= 0) { 
          return key.slice(0, key.indexOf("?")).replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
      }
      return key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  }

  /**
   * Returns a string path of where all of the cabals are stored on the hard drive.
   * @returns {string} the cabal directory
   */
  static getCabalDirectory () {
    return path.join(os.homedir(), '.cabal', `v${Client.getDatabaseVersion()}`)
  }

  /**
   * Resolve the DNS shortname `name`. If `name` is already a cabal key,  it will
   * be returned and the DNS lookup is aborted.
   * If `name` is a whisper:// key, a DHT lookup for the passed-in key will occur. 
   * Once a match is found, it is assumed to be a cabal key, which is returned.
   * Returns the cabal key in `cb`. If `cb` is null a Promise is returned.
   * @param {string} name the DNS shortname, or whisper:// shortname
   * @param {function(string)} [cb] The callback to be called when lookup succeeds
   */
  resolveName (name, cb) {
    if (name.startsWith('whisper://') || 
        // whisperlink heuristic: ends with -<hexhexhex>
        name.slice(-4).toLowerCase().match(/-[0-9a-f]{3}/)) { 
        return new Promise((resolve, reject) => {
            let key = ''
            const topic = name.startsWith('whisper://') ? name.slice(10) : name
            const stream = paperslip.read(topic)
            stream.on('data', (data) => {
              if (data) { key += data.toString() }
            })
            stream.on('end', () => { resolve(key) })
            stream.once('error', (err) => { reject(err) })
        })
    } else {
        return this.cabalDns.resolveName(name).then((key) => {
          if (key === null) return null
          if (!cb) return key
          else cb(key)
        })
      }
  }

  /**
   * Create a new cabal.
   * @returns {Promise} a promise that resolves into a `CabalDetails` instance.
   */
  createCabal (cb) {
    const key = Client.generateKey()
    return this.addCabal(key, cb)
  }

  /**
   * Add/load the cabal at `key`.
   * @param {string} key
   * @param {object} opts
   * @param {function(string)} cb a function to be called when the cabal has been initialized.
   * @returns {Promise} a promise that resolves into a `CabalDetails` instance.
   */
  addCabal (key, opts, cb) {
    if (typeof key === 'object' && !opts) {
      opts = key
      key = undefined
    }
    if (typeof opts === 'function' && !cb) {
      cb = opts
      opts = {}
    }
    opts = opts || {}
    if (!cb || typeof cb !== 'function') cb = function noop () {}
    let cabalPromise
    let dnsFailed = false
    if (typeof key === 'string') {
      cabalPromise = this.resolveName(key.trim()).then((resolvedKey) => {
        // discard uri scheme and search params of cabal key, if present. returns 64 chr hex string
        const scrubbedKey = Client.scrubKey(resolvedKey)
        // TODO: export cabal-core's isHypercoreKey() and use here & verify that scrubbedKey is 64 ch hex string
        if (resolvedKey === null) {
          dnsFailed = true
          return
        }
        let { temp, dbdir, preferredPort } = this.config
        preferredPort = preferredPort || 0 
        dbdir = dbdir || path.join(Client.getCabalDirectory(), 'archives')
        const storage = temp ? ram : polyraf(path.join(dbdir, scrubbedKey))
        if (!temp) try { mkdirp.sync(path.join(dbdir, scrubbedKey, 'views')) } catch (e) {}
        var db = temp ? memdb() : level(path.join(dbdir, scrubbedKey, 'views'))

        if (!resolvedKey.startsWith('cabal://')) resolvedKey = 'cabal://' + resolvedKey
        const uri = new URL(resolvedKey)
        const modKeys = uri.searchParams.getAll('mod')
        const adminKeys = uri.searchParams.getAll('admin')

        var cabal = Cabal(storage, scrubbedKey, { modKeys, adminKeys, db, preferredPort, maxFeeds: this.maxFeeds })
        this._keyToCabal[scrubbedKey] = cabal
        return cabal
      })
    } else { // a cabal instance was passed in, instead of a cabal key string
      cabalPromise = new Promise((resolve, reject) => {
        var cabal = key
        this._keyToCabal[Client.scrubKey(cabal.key)] = cabal
        resolve(cabal)
      })
    }
    return new Promise((resolve, reject) => {
      cabalPromise.then((cabal) => {
        if (dnsFailed) return reject(new Error('dns failed to resolve'))
        cabal = this._coerceToCabal(cabal)
        cabal.ready(() => {
          if (!this.currentCabal) {
            this.currentCabal = cabal
          }
          const details = new CabalDetails({
            cabal,
            client: this,
            commands: this.commands,
            aliases: this.aliases
          }, done)
          this.cabals.set(cabal, details)
          if (!opts.noSwarm) cabal.swarm()
          function done () {
            details._emitUpdate('init')
            cb()
            resolve(details)
          }
        })
      })
    })
  }

  /**
   * Focus the cabal at `key`, used when you want to switch from one open cabal to another.
   * @param {string} key
   */
  focusCabal (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }
    this.currentCabal = cabal
    const details = this.cabalToDetails(cabal)
    details._emitUpdate('cabal-focus', { key })
    return details
  }

  /**
   * Remove the cabal `key`. Destroys everything related to it
   * (the data is however still persisted to disk, fret not!).
   * @param {string} key
   * @param {function} cb
   */
  removeCabal (key, cb) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }

    const details = this.cabalToDetails(cabal)
    details._destroy(cb)

    // burn everything we know about the cabal
    delete this._keyToCabal[Client.scrubKey(key)]
    return this.cabals.delete(cabal)
  }

  /**
   * Returns the details of a cabal for the given key.
   * @returns {CabalDetails}
   */
  getDetails (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) { return null }
    return this.cabalToDetails(cabal)
  }

  /**
   * Returns a list of cabal keys, one for each open cabal.
   * @returns {string[]}
   */
  getCabalKeys () {
    return Object.keys(this._keyToCabal).sort()
  }

  /**
   * Get the current cabal.
   * @returns {CabalDetails}
   */
  getCurrentCabal () {
    return this.cabalToDetails(this.currentCabal)
  }

  /**
   * Add a command to the set of supported commands.
   * @param {string} [name] the long-form command name
   * @param {object} [cmd] the command object
   * @param {function} [cmd.help] function returning help text
   * @param {array} [cmd.alias] array of string aliases
   * @param {function} [cmd.call] implementation of the command receiving (cabal, res, arg) arguments
   */
  addCommand (name, cmd) {
    this.commands[name] = cmd
    ;(cmd.alias || []).forEach(alias => {
      this.aliases[alias] = name
    })
  }

  /**
   * Remove a command.
   * @param {string} [name] the command name
   */
  removeCommand (name) {
    var cmd = this.commands[name]
    ;(cmd.alias || []).forEach(alias => {
      delete this.aliases[alias]
    })
    delete this.commands[name]
  }

  /**
   * Get an object mapping command names to command objects.
   */
  getCommands () {
    return this.commands
  }

  /**
   * Add an alias `shortCmd` for `longCmd`
   * @param {string} [longCmd] command to be aliased
   * @param {string} [shortCmd] alias
   */
  addAlias (longCmd, shortCmd) {
    this.aliases[shortCmd] = longCmd
    this.commands[longCmd].alias.push(shortCmd)
  }

  /**
   * Returns the `cabal-core` instance corresponding to the cabal key `key`. `key` is scrubbed internally.
   * @method
   * @param {string} key
   * @returns {Cabal} the `cabal-core` instance
   * @access private
   */
  _getCabalByKey (key) {
    key = Client.scrubKey(key)
    if (!key) {
      return this.currentCabal
    }
    return this._keyToCabal[key]
  }

  /**
   * Returns a `CabalDetails` instance for the passed in `cabal-core` instance.
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {CabalDetails}
   */
  cabalToDetails (cabal = this.currentCabal) {
    if (!cabal) { return null }
    const details = this.cabals.get(cabal)
    if (details) {
      return details
    }
    // Could not resolve cabal to details, did you pass in a cabal instance?
    return null
  }

  /**
   * Add a status message, displayed client-side only, to the specified channel and cabal.
   * If no cabal is specified, the currently focused cabal is used.
   * @param {object} message
   * @param {string} channel
   * @param {Cabal} [cabal=this.currentCabal]
   */
  addStatusMessage (message, channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).addStatusMessage(message, channel)
  }

  /**
   * Clear status messages for the specified channel.
   * @param {string} channel
   * @param {Cabal} [cabal=this.currentCabal]
   */
  clearStatusMessages (channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).clearVirtualMessages(channel)
  }

  /**
   * Returns a list of all the users for the specified cabal.
   * If no cabal is specified, the currently focused cabal is used.
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {Object[]} the list of users
   */
  getUsers (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getUsers()
  }

  /**
   * Returns a list of channels the user has joined for the specified cabal.
   * If no cabal is specified, the currently focused cabal is used.
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {Object[]} the list of Channels
   */
  getJoinedChannels (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getJoinedChannels()
  }

  /**
   * Returns a list of all channels for the specified cabal.
   * If no cabal is specified, the currently focused cabal is used.
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {Object[]} the list of Channels
   */
  getChannels (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannels()
  }

  _coerceToCabal (key) {
    if (key instanceof Cabal) {
      return key
    }
    return this._keyToCabal[Client.scrubKey(key)]
  }

  /**
   * Add a new listener for the `update` event.
   * @param {function} listener
   * @param {Cabal} [cabal=this.currentCabal]
   */
  subscribe (listener, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).on('update', listener)
  }

  /**
   * Remove a previously added listener.
   * @param {function} listener
   * @param {Cabal} [cabal=this.currentCabal]
   */
  unsubscribe (listener, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).removeListener('update', listener)
  }

  /**
   * Returns a list of messages according to `opts`. If `cb` is null, a Promise is returned.
   * @param {Object} [opts]
   * @param {number} [opts.olderThan] timestamp in epoch time. we want to get messages that are *older* than this ts
   * @param {number} [opts.newerThan] timestamp in epoch time. we want to get messages that are *newer* than this ts
   * @param {number} [opts.amount] amount of messages to get
   * @param {string} [opts.channel] channel to get messages from. defaults to currently focused channel
   * @param {function} [cb] the callback to be called when messages are retreived
   * @param {Cabal} [cabal=this.currentCabal]
   */
  getMessages (opts, cb, cabal = this.currentCabal) {
    var details = this.cabalToDetails(cabal)
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    opts = opts || {}
    var pageOpts = {}
    if (opts.olderThan) pageOpts.lt = parseInt(opts.olderThan) - 1 // - 1 because leveldb.lt seems to include the value we send it?
    if (opts.newerThan) pageOpts.gt = parseInt(opts.newerThan) // if you fix the -1 hack above, make sure that backscroll in cabal-cli works
    if (opts.amount) pageOpts.limit = parseInt(opts.amount)
    if (!opts.channel) { opts.channel = details.getCurrentChannel() }

    const channel = details.getChannel(opts.channel)
    const prom = (!channel) ? Promise.resolve([]) : channel.getPage(pageOpts)
    if (!cb) { return prom }
    prom.then(cb)
  }

  /**
   * Searches for messages that include the search string according to `opts`.
   * Each returned match contains a message string and a matchedIndexes array containing the indexes at which the search string was found in the message
   * @param {string} [searchString] string to match messages against
   * @param {Object} [opts]
   * @param {number} [opts.olderThan] timestamp in epoch time. we want to search through messages that are *older* than this ts
   * @param {number} [opts.newerThan] timestamp in epoch time. we want to search through messages that are *newer* than this ts
   * @param {number} [opts.amount] amount of messages to be search through
   * @param {string} [opts.channel] channel to get messages from. defaults to currently focused channel
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {Promise} a promise that resolves into a list of matches.
   */
  searchMessages (searchString, opts, cabal = this.currentCabal) {
    return new Promise((resolve, reject) => {
      if (!searchString || searchString === '') {
        return reject(new Error('search string must be set'))
      }

      const searchBuffer = Buffer.from(searchString)

      const matches = []

      this.getMessages(opts, null, cabal).then((messages) => {
        messages.forEach(message => {
          const messageContent = message.value.content
          if (messageContent) {
            const textBuffer = Buffer.from(messageContent.text)

            /* positions at which the string was found, can be used for highlighting for example */
            const matchedIndexes = []

            /* use a labeled for-loop to cleanly continue top-level iteration */
            charIteration:
            for (let charIndex = 0; charIndex <= textBuffer.length - searchBuffer.length; charIndex++) {
              if (textBuffer[charIndex] == searchBuffer[0]) {
                for (let searchIndex = 0; searchIndex < searchBuffer.length; searchIndex++) {
                  if (!(textBuffer[charIndex + searchIndex] == searchBuffer[searchIndex])) { continue charIteration }
                }
                matchedIndexes.push(charIndex)
              }
            }

            if (matchedIndexes.length > 0) {
              matches.push({ message, matchedIndexes })
            }
          }
        })
        resolve(matches)
      })
    })
  }

  /**
   * Returns the number of unread messages for `channel`.
   * @param {string} channel
   * @param {Cabal} [cabal=this.currentCabal]
   * @returns {number}
   */
  getNumberUnreadMessages (channel, cabal = this.currentCabal) {
    var details = this.cabalToDetails(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    const count = this.cabalToDetails(cabal).getChannel(channel).getNewMessageCount()
    return count
  }

  /**
   * Returns the number of mentions in `channel`.
   * @param {string} [channel=this.getCurrentChannel()]
   * @param {Cabal} [cabal=this.currentCabal]
   */
  getNumberMentions (channel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannel(channel).getMentions().length
  }

  /**
   * Returns a list of messages that triggered a mention in channel.
   * @param {string} [channel=this.getCurrentChannel()]
   * @param {Cabal} [cabal=this.currentCabal]
   */
  getMentions (channel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannel(channel).getMentions()
  }

  /**
   * View `channel`, closing the previously focused channel.
   * @param {*} [channel=this.getCurrentChannel()]
   * @param {boolean} [keepUnread=false]
   * @param {Cabal} [cabal=this.currentCabal]
   */
  focusChannel (channel, keepUnread = false, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).focusChannel(channel, keepUnread)
  }

  /**
   * Close `channel`.
   * @param {string} [channel=this.getCurrentChannel()]
   * @param {string} [newChannel=null]
   * @param {Cabal} [cabal=this.currentCabal]
   */
  unfocusChannel (channel, newChannel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).unfocusChannel(channel, newChannel)
  }

  /**
   * Returns the currently focused channel name.
   * @returns {string}
   */
  getCurrentChannel () {
    return this.cabalToDetails(this.currentCabal).getCurrentChannel()
  }

  /**
   * Mark the channel as read.
   * @param {string} channel
   * @param {Cabal} [cabal=this.currentCabal]
   */
  markChannelRead (channel, cabal = this.currentCabal) {
    var details = this.cabalToDetails(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    this.cabalToDetails(cabal).getChannel(channel).markAsRead()
  }
}

module.exports = Client
