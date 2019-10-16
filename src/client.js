const Cabal = require('cabal-core')
const CabalDetails = require('./cabal-details')
const crypto = require('hypercore-crypto')
const DatDns = require('dat-dns')
const ram = require('random-access-memory')
const memdb = require('memdb')
const level = require('level')
const path = require('path')
const mkdirp = require('mkdirp')
const os = require('os')

class Client {
  /**
   * Create a client instance from which to manage multiple 
   * [`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.
   * @constructor
   * @param {object} [opts]
   * @param {object} opts.config
   * @param {boolean} opts.config.temp if `temp` is true no data is persisted to disk.
   * @param {string} [opts.config.dbdir] the directory to store the cabal data
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
          dbdir: null
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

    let cabalDnsOpts = {
      hashRegex: /^[0-9a-f]{64}?$/i,
      recordName: 'cabal',
      protocolRegex: /^cabal:\/\/([0-9a-f]{64})/i,
      txtRegex: /^"?cabalkey=([0-9a-f]{64})"?$/i
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
   * Removes URI scheme and returns the cabal key as a 64 character hex string
   * @param {string} key the key to scrub
   * @returns {string} the scrubbed key 
   * @example
   * Client.scrubKey('cabal://12345678...')
   * // => '12345678...'
   */
  static scrubKey (key) {
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
   * Returns the cabal key in `cb`. If `cb` is null a Promise is returned.
   * @param {string} name the DNS shortname
   * @param {function(string)} [cb] The callback to be called when DNS lookup succeeds
   */
  resolveName (name, cb) {
    return this.cabalDns.resolveName(name).then((key) => {
      if (key === null) return null
      if (!cb) return Client.scrubKey(key)
      cb(Client.scrubKey(key))
    })
  }

  /**
   * Create a new cabal.
   * @returns {Promise} a promise that resolves into a `CabalDetails` instance.
   */
  createCabal () {
    const key = Client.generateKey()
    return this.addCabal(key)
  }


  /**
   * Add/load the cabal at `key`. 
   * @param {string} key 
   * @param {function(string)} cb a function to be called when the cabal has been initialized.
   * @returns {Promise} a promise that resolves into a `CabalDetails` instance.
   */
  addCabal (key, cb) {
    if (!cb || typeof cb !== 'function') cb = function noop () {}
    let cabalPromise
    let dnsFailed = false
    if (typeof key === 'string') {
      cabalPromise = this.resolveName(key).then((resolvedKey) => {
        if (resolvedKey === null) {
          dnsFailed = true
          return
        }
        let {temp, dbdir} = this.config
        dbdir = dbdir || path.join(Client.getCabalDirectory(), 'archives')
        const storage = temp ? ram : path.join(dbdir, resolvedKey)
        if (!temp) try { mkdirp.sync(path.join(dbdir, resolvedKey, 'views')) } catch (e) {}
        var db = temp ? memdb() : level(path.join(dbdir, resolvedKey, 'views'))
        var cabal = Cabal(storage, resolvedKey, {db: db, maxFeeds: this.maxFeeds})
        this._keyToCabal[resolvedKey] = cabal
        return cabal
      })
    } else {
      cabalPromise = new Promise((resolve, reject) => {
        // a cabal instance was passed in
        var cabal = key
        this._keyToCabal[cabal.key] = cabal
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
          const details = new CabalDetails(cabal, cb)
          this.cabals.set(cabal, details)
          cabal.swarm()
          this.getCurrentCabal()._emitUpdate()
          resolve(details)
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
    return this.cabalToDetails(cabal)
  }

  /**
   * Remove the cabal `key`. Destroys everything related to it 
   * (the data is however still persisted to disk, fret not!).
   * @param {string} key 
   */
  removeCabal (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }

    const details = this.cabalToDetails(cabal)
    details._destroy()

    // burn everything we know about the cabal
    this._keyToCabal[key] = null
    return this.cabals.delete(cabal)
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
   * @param {string} message 
   * @param {string} channel 
   * @param {Cabal} [cabal=this.currentCabal]
   */
  addStatusMessage (message, channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).addStatusMessage(message)
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
    return this._keyToCabal[key]
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
    const prom = details.getChannel(opts.channel).getPage(pageOpts)
    if (!cb) { return prom }
    prom.then(cb)
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
    let count = this.cabalToDetails(cabal).getChannel(channel).getNewMessageCount()
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
    this.cabalToDetails(cabal)._emitUpdate()
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