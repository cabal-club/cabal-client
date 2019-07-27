const Cabal = require('cabal-core')
const CabalDetails = require('./cabal-details')
const crypto = require('hypercore-crypto')
const ram = require('random-access-memory')
const memdb = require('memdb')
const level = require('level')
const path = require('path')
const mkdirp = require("mkdirp")

/*
const cabalDns = require('dat-dns')({
  hashRegex: /^[0-9a-f]{64}?$/i,
  recordName: 'cabal',
  protocolRegex: /^cabal:\/\/([0-9a-f]{64})/i,
  txtRegex: /^"?cabalkey=([0-9a-f]{64})"?$/i,
  persistentCache: {
    read: async function (name, err) {
      if (name in config.cache) {
        var cache = config.cache[name]
        if (cache.expiresAt < Date.now()) { // if ttl has expired: warn, but keep using
            console.log(`${chalk.redBright('Note:')} the TTL for ${name} has expired`)
        }
        return cache.key
      }
      // dns record wasn't found online and wasn't in the cache
      throw err
    },
    write: async function (name, key, ttl) {
      var expireOffset = +(new Date(ttl * 1000)) // convert to epoch time
      var expiredTime = Date.now() + expireOffset
      config.cache[name] = { key: key, expiresAt: expiredTime }
      saveConfig(configFilePath, config)
    }
  }
})
*/
class Client {
  constructor (opts) {
    if (!(this instanceof Client)) return new Client(opts)
    // This is redundant, but we might want to keep the cabal map around
    // in the case the user has access to cabal instances
    this._keyToCabal = {}
    // maps a cabal-core instance to a CabalDetails object
    this.cabals = new Map()
    this.currentCabal = null
    this.config = opts.config
    this.maxFeeds = opts.maxFeeds || 1000
  }

  static getDatabaseVersion () {
    return Cabal.databaseVersion
  }

  static scrub (key) {
    return key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  }

  createCabal () {
    return this.addCabal(crypto.keyPair().publicKey.toString('hex'))
  }

  addCabal (key) {
    return new Promise((resolve, reject) => {
      var cabal
      // error states?
      if (typeof key === 'string') {
        key = Client.scrub(key)
        const {temp, dbdir} = this.config
        const storage = temp ? ram : dbdir + key
        if (!temp) try { mkdirp.sync(path.join(dbdir, key, 'views')) } catch (e) {}
        var db = temp ? memdb() : level(path.join(dbdir, key, 'views'))
        cabal = Cabal(storage, key, {db: db, maxFeeds: this.maxFeeds})
        this._keyToCabal[key] = cabal
      } else {
        // a cabal instance was passed in
        cabal = key
        this._keyToCabal[cabal.key] = cabal
      }

      if (!this.currentCabal) {
        this.currentCabal = cabal
      }

      cabal.ready(() => {
        const details = new CabalDetails(cabal)
        this.cabals.set(cabal, details)
        cabal.swarm()
        this.getCurrentCabal()._emitUpdate()
        resolve(details)
      })
    })
  }

  focusCabal (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }
    this.currentCabal = cabal
    return this.cabalToDetails(cabal)
  }

  removeCabal (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }

    const details = this.cabals.get(cabal)
    details._destroy()

    // burn everything we know about the cabal
    this._keyToCabal[key] = null
    return this.cabals.delete(cabal)
  }

  getCabalKeys () {
    return Object.keys(this._keyToCabal) // ???: sorted?
  }

  getCurrentCabal () {
    return this.cabalToDetails(this.currentCabal)
  }

  getCabalByKey (key) {
    if (!key) {
      return this.currentCabal
    }
    return this._keyToCabal[key]
  }

  cabalToDetails (cabal = this.currentCabal) {
    return this.cabals.get(cabal)
  }

  connect (cabal = this.currentCabal) {
    cabal.ready(cabal.swarm)
  }

  getUsers (cabal = this.currentCabal) {
    return this.cabals.get(cabal).getUsers()
  }

  getJoinedChannels (cabal = this.currentCabal) {
    return this.cabals.get(cabal).getJoinedChannels()
  }

  getChannels (cabal = this.currentCabal) {
    return this.cabals.get(cabal).getChannels()
  }

  _coerceToCabal (key) {
    if (key instanceof Cabal) {
      return key
    }
    return this._keyToCabal[key]
  }

  subscribe (cabal = this.currentCabal, listener) {
    this.cabals.get(cabal).on('update', listener)
  }

  unsubscribe (cabal = this.currentCabal, listener) {
    this.cabals.get(cabal).removeListener('update', listener)
  }

  getMessages (opts, cb, cabal = this.currentCabal) {
    var details = this.cabals.get(cabal)
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

  getNumberUnreadMessages (channel, cabal = this.currentCabal) {
    var details = this.cabals.get(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    let count = this.cabals.get(cabal).getChannel(channel).getNewMessageCount()
    return count
  }

  getNumberMentions (channel, cabal = this.currentCabal) {
    return this.cabals.get(cabal).getChannel(channel).getMentions().length
  }

  getMentions (channel, cabal = this.currentCabal) {
    return this.cabals.get(cabal).getChannel(channel).getMentions()
  }

  // returns { newMessageCount: <number of messages unread>, lastRead: <timestamp> }
  openChannel (channel, cabal = this.currentCabal) {
    this.cabals.get(cabal).openChannel(channel)
    var details = this.cabals.get(cabal)._emitUpdate()
  }

  closeChannel (channel, cabal = this.currentCabal) {
    return this.cabals.get(cabal).closeChannel(channel)
  }

  markChannelRead (channel, cabal = this.currentCabal) {
    var details = this.cabals.get(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    this.cabals.get(cabal).getChannel(channel).markAsRead()
  }
}

module.exports = Client
