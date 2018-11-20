var swarm = require('cabal-core/swarm.js')

function Client (cabal) {
  if (!(this instanceof Client)) return new Client(cabal)

  this.connect = function () {
    cabal.db.ready(function () {
      swarm(cabal)
    })
  }

  this.getOpenChannels = function (channels) {
    // TODO
  }

  this.getUnreadMessages = function (channel) {
    // TODO
  }

  this.openChannel = function (channel) {
    // TODO
  }

  this.closeChannel = function (channel) {
    // TODO
  }

  this.markChannelRead = function (channel) {
    // TODO
  }
}

module.exports = Client
