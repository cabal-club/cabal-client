const Cabal = require('cabal-core')
const swarm = require('cabal-core/swarm.js')
const EventEmitter = require('events')

class Client {
  constructor(props) {
    if (!(this instanceof Client)) return new Client(props)
    // This is redundant, but we might want to keep the cabal map around
    // in the case the user has access to cabal instances
    this._keyToCabal = {}
    this.cabals = new Map()
    this.currentCabal = null
    this.maxFeeds = props.maxFeeds || 1000
  }

  addCabal(key) {
    return new Promise((resolve, reject) => {
      var cabal
      // error states?
      if (typeof key === "string") {
        key = key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
        var db = this.archivesdir + key
        cabal = Cabal(db, key, { maxFeeds: this.maxFeeds })
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
        this.cabals.set(cabal, new CabalDetails(cabal))
        cabal.swarm()
        resolve(cabal)
      })
    })
  }

  focusCabal (key) {
    const cabal = this._coerceToCabal(key)
    if (!cabal) {
      return false
    }
    this.currentCabal = cabal
  }

  removeCabal(key) {
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

  getCabalByKey(key) {
    if (!key) {
      return this.currentCabal
    }
    return this._keyToCabal[key]
  }

  connect(cabal=this.currentCabal) {
    cabal.ready(cabal.swarm) 
  }

  getUsers(cabal=this.currentCabal) {
    return this.cabals.get(cabal).users
  }

  getOpenChannels(cabal=this.currentCabal) {
    return this.cabals.get(cabal).getChannels()
  }

  _coerceToCabal(key) {
    if (key instanceof Cabal) {
      return key
    }
    return this._keyToCabal[key]
  }

  subscribe(cabal=this.currentCabal, listener) {
    this.cabals.get(cabal).on('update', listener)
  }

  unsubscribe(cabal=this.currentCabal, listener) {
    this.cabals.get(cabal).removeListener('update', listener)
  }

  getUnreadMessages(channel) {
    // TODO
  }

  openChannel(channel) {
    this.cabals.get(cabal).openChannel(channel)
  }

  closeChannel(channel) {
    // TODO
  }

  markChannelRead(channel) {
    // TODO
  }
}

class CabalDetails extends EventEmitter {
  constructor(cabal) {
    this._cabal = cabal
    
    this.joinedChannels = []

    this.channels = {
      '!status': new ChannelDetails()
    }

    this.currentChannel = '' // a ChannelDetails instance
    this.name = ''
    this.topic = ''
    this.users = {}
    this.listeners = [] // keep track of listeners so we can remove them when we remove a cabal
    this.user = { local: true, online: true, key: '' }
    this._initialize(cabal)
  }

  openChannel(channel) {
    this.currentChannel.opened = false // close the previous channel
    this.currentChannel = this.channels[channel]
    this.currentChannel.opened = true
  }

  joinChannel(channel) {
    if (this.joinedChannels.indexOf(channel) < 0) {
      this.joinedChannels.push(channel)
    }
    this.currentChannel = this.channels[channel]
    // we probably always want to open a joined channel
    this.openChannel(channel)
  }

  leaveChannel(channel) {
    var index = this.joinedChannels.indexOf(channel) 
    if (index <= 0) { return } // can't remove status ^_^
    openChannel(this.joinedChannels[index-1])
    this.joinedChannels.splice(index, 1)
  }

  getUsers() {
    return this.users
  }

  _emitUpdate() {
    this.emit('update', this)
  }

  getChannels() {
    return Object.keys(this.channels)
  }

  registerListener(source, event, listener) {
    this.listeners.push({ source, event, listener })
    source.on(event, listener)
  }

  _destroy () {
    this.listeners.forEach((obj) => { obj.source.removeListener(obj.event, obj.listener)})
  }

  _initializeUser() {
    cabal.getLocalKey((err, lkey) => {
      if (err) throw err
      // set local key for local user
      this.user.key = lkey
      // try to get more data for user
      cabal.users.get(lkey, (err, user) => {
        this.user = user
        this.user.local = true
        this.user.online = true
        this._emitUpdate()
      })
    })
  }

  _initialize(cabal) {
    cabal.channels.get((err, channels) => {
      this.channels = this.channels.concat(channels)
    })

    this.registerListener(cabal.channels.events, 'add', (channel) => {
      // for the future: don't show new channel as a joined channel, but 
      // allow visualizations such as (23 channels)
      this.channels.push(channel)
      this.channels.sort()
      this._emitUpdate()
    })

    cabal.users.getAll((err, users) => {
      if (err) return
      this.users = users
      this._initializeUser()

      this.registerListener(cabal.users.events, 'update', (key) => {
        // TODO: rate-limit
        cabal.users.get(key, (err, user) => {
          if (err) return
          this.users[key] = Object.assign(this.users[key] || {}, user)
          if (this.user && key === this.user.key) this.user = this.users[key]
          this._emitUpdate()
        })
      })

      this.registerListener(cabal.topics.events, 'update', (msg) => {
        this.topic = msg.value.content.topic
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

class ChannelDetails {
  constructor(channel) {
    this.name = channel
    this.newMessages = false
    this.joined = false
    this.opened = false
  }
}


module.exports = Client
