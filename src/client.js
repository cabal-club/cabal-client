const Cabal = require('cabal-core')
const CabalDetails = require('./cabal-details')
const crypto = require('hypercore-crypto')
const DatDns = require("dat-dns")
const ram = require('random-access-memory')
const memdb = require('memdb')
const level = require('level')
const path = require('path')
const mkdirp = require("mkdirp")

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

    let cabalDnsOpts = {
        hashRegex: /^[0-9a-f]{64}?$/i,
        recordName: 'cabal',
        protocolRegex: /^cabal:\/\/([0-9a-f]{64})/i,
        txtRegex: /^"?cabalkey=([0-9a-f]{64})"?$/i,
    }
    // also takes opts.persistentCache which has a read and write function
    //   read: async function ()   // aka cache lookup function
    //   write: async function ()  // aka cache write function
    if (opts.persistentCache) cabalDnsOpts.persistentCache = opts.persistentCache
    this.cabalDns = DatDns(cabalDnsOpts)
  }

  static getDatabaseVersion () {
    return Cabal.databaseVersion
  }

  static scrubKey (key) {
    return key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  }

  resolveName (name, cb) {
      return this.cabalDns.resolveName(name).then((key) => { 
          if (!cb) return Client.scrubKey(key)
          cb(Client.scrubKey(key)) 
      })
  }

  createCabal () {
    return this.addCabal(crypto.keyPair().publicKey.toString('hex'))
  }

  addCabal (key, cb) {
      if (!cb) cb = function noop () {}
      let cabalPromise
      if (typeof key === 'string') {
          cabalPromise = this.resolveName(key).then((resolvedKey) => {
            const {temp, dbdir} = this.config
            const storage = temp ? ram : dbdir + resolvedKey
            if (!temp) try { mkdirp.sync(path.join(dbdir, resolvedKey, 'views')) } catch (e) {}
            var db = temp ? memdb() : level(path.join(dbdir, resolvedKey, 'views'))
            var cabal = Cabal(storage, resolvedKey, {db: db, maxFeeds: this.maxFeeds})
            this._keyToCabal[resolvedKey] = cabal
            return cabal
          })
      } else {
          cabalPromise = new Promise((res, rej) => {
            // a cabal instance was passed in
            var cabal = key
            this._keyToCabal[cabal.key] = cabal
            res(cabal)
          })
      }
      return new Promise((res, rej) => {
          cabalPromise.then((cabal) => {
              if (!this.currentCabal) {
                  this.currentCabal = cabal
              }
              cabal.ready(() => {
                  const details = new CabalDetails(cabal, cb)
                  this.cabals.set(cabal, details)
                  cabal.swarm()
                  this.getCurrentCabal()._emitUpdate()
                  res(details)
              })
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

    const details = this.cabalToDetails(cabal)
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
    const details = this.cabals.get(cabal)
    if (details) {
      return details
    }
    throw new Error('Could not resolve cabal to details, did ya pass in a cabal instance?')
  }

  connect (cabal = this.currentCabal) {
    cabal.ready(cabal.swarm)
  }

  addStatusMessage (message, channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).addStatusMessage(message)
  }

  clearStatusMessages (channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).clearVirtualMessages(channel)
  }

  getUsers (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getUsers()
  }

  getJoinedChannels (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getJoinedChannels()
  }

  getChannels (cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannels()
  }

  _coerceToCabal (key) {
    if (key instanceof Cabal) {
      return key
    }
    return this._keyToCabal[key]
  }

  subscribe (cabal = this.currentCabal, listener) {
    this.cabalToDetails(cabal).on('update', listener)
  }

  unsubscribe (cabal = this.currentCabal, listener) {
    this.cabalToDetails(cabal).removeListener('update', listener)
  }

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

  getNumberUnreadMessages (channel, cabal = this.currentCabal) {
    var details = this.cabalToDetails(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    let count = this.cabalToDetails(cabal).getChannel(channel).getNewMessageCount()
    return count
  }

  getNumberMentions (channel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannel(channel).getMentions().length
  }

  getMentions (channel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).getChannel(channel).getMentions()
  }

  // returns { newMessageCount: <number of messages unread>, lastRead: <timestamp> }
  focusChannel (channel, cabal = this.currentCabal) {
    this.cabalToDetails(cabal).focusChannel(channel)
    var details = this.cabalToDetails(cabal)._emitUpdate()
  }

  unfocusChannel (channel, cabal = this.currentCabal) {
    return this.cabalToDetails(cabal).unfocusChannel(channel)
  }

  getCurrentChannel () {
    return this.cabalToDetails(this.currentCabal).getCurrentChannel()
  }

  markChannelRead (channel, cabal = this.currentCabal) {
    var details = this.cabalToDetails(cabal)
    if (!channel) { channel = details.getCurrentChannel() }
    this.cabalToDetails(cabal).getChannel(channel).markAsRead()
  }
}

module.exports = Client
