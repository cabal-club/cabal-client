const Cabal = require('cabal-core')
const swarm = require('cabal-core/swarm.js')

class Client {
  constructor(props) {
    if (!(this instanceof Client)) return new Client(props)
    this.cabals = new Map()
    this.currentCabal = null
    this.currentChannel = ''
    this.maxFeeds = props.maxFeeds || 20 // TODO: what's a sane default?
  }

  addCabal(key) {
    return new Promise((resolve, reject) => {
      // error states?
      key = key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
      var db = this.archivesdir + key
      var cabal = Cabal(db, key, { maxFeeds: this.maxFeeds })
      cabal.ready(() => {
        this.cabals.set(cabal, new CabalDetails())
        cabal.swarm()
        this.initializeCabalClient(cabal)
        resolve(cabal)
      })
    })
  }

  connect(cabal=this.currentCabal) {
    cabal.db.ready(() => swarm(cabal))
  }

  getUsers(cabal=this.currentCabal) {
    return this.cabals.get(cabal).users
  }

  getOpenChannels(cabal=this.currentCabal) {
    return this.cabals.get(cabal).getChannels()
  }

  getUnreadMessages(channel) {
    // TODO
  }

  openChannel(channel) {
    // TODO
  }

  closeChannel(channel) {
    // TODO
  }

  markChannelRead(channel) {
    // TODO
  }
}

class CabalDetails {
  constructor() {
    this.channels = {
      '!status': '' // what should this hash be?
    }
    this.aliases = new Set()
    this.users = {}
    this.user = { local: true, online: true, key: '' }
  }

  getChannels() {
    return Object.keys(this.channels)
  }
}

module.exports = Client
