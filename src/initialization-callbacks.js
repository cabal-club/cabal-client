const timestamp = require('monotonic-timestamp')
const { ChannelDetails } = require('./channel-details')
const User = require('./user')
/* this file contains callbacks used for populating the initial state. these are all invoked inside
 * CabalDetails._initialize. once all the callbacks have finished, cabal-client is ready to be used & queried.
 *
 * each callback calls this._finish() to signal it is done.
 */
module.exports.getArchivesCallback = function (err, archivedChannels) {
  const cabal = this.core
  // populate channels
  cabal.channels.get((err, channels) => {
    channels.forEach((channel) => {
      const details = this.channels[channel]
      if (!details) {
        this.channels[channel] = new ChannelDetails(cabal, channel)
        // listen for updates that happen within the channel
        // note: only add listener if we don't have a channel registered (=> prevent duplicate listeners)
        cabal.messages.events.on(channel, this.messageListener.bind(this))
      }
      // mark archived channels as such
      if (archivedChannels.indexOf(channel) >= 0) {
        this.channels[channel].archive()
      }

      // add all users joined to a channel
      cabal.memberships.getUsers(channel, (err, users) => {
        users.forEach((u) => this.channels[channel].addMember(u))
      })

      // for each channel, get the topic
      cabal.topics.get(channel, (err, topic) => {
        this.channels[channel].topic = topic || ''
      })
    })

    this._finish()
  })
}

module.exports.getLocalKeyCallback = function (err, lkey) {
  const cabal = this.core
  cabal.memberships.getMemberships(lkey, (err, channels) => {
    if (channels.length === 0) {
      // make `default` the first channel if no saved state exists
      this.joinChannel('default')
    }
    for (const channel of channels) {
      // it's possible to be joined to a channel that `cabal.channels.get` doesn't return
      // (it's an empty channel, with no messages)
      const details = this.channels[channel]
      if (!details) {
        this.channels[channel] = new ChannelDetails(cabal, channel)
        // listen for updates that happen within the channel
        cabal.messages.events.on(channel, this.messageListener.bind(this))
      }
      this.channels[channel].joined = true
    }
    this._finish()
  })
}

module.exports.getAllUsersCallback = function (err, users) {
  const cabal = this.core
  if (err) return
  this.users = new Map()
  Object.keys(users).forEach(key => {
    this.users[key] = new User(users[key])
  })

  // Load moderation state
  const loadModerationState = (cb) => {
    cabal.moderation.list((err, list) => {
      if (err) return cb(err)
      list.forEach(info => {
        const user = this.users[info.id]
        if (user) user.flags.set(info.channel, info.flags)
      })
      cb()
    })
  }

  this._initializeLocalUser(() => {
    loadModerationState(() => {
      this.registerListener(cabal.moderation.events, 'update', (info) => {
        let user = this.users[info.id]
        let changedRole = {}
        if (!user) {
          const flags = new Map()
          flags.set(info.group, info.flags)
          user = new User({ key: info.id, flags: flags })
          this.users[info.id] = user
        } else {
          changedRole = { mod: user.isModerator(), admin: user.isAdmin(), hidden: user.isHidden() }
          user.flags.set(info.group, info.flags)
          changedRole.mod = changedRole.mod != user.isModerator()
          changedRole.admin = changedRole.admin != user.isAdmin()
          changedRole.hidden = changedRole.hidden != user.isHidden()
        }
        const issuer = this.users[info.by]
        if (!issuer) return

        this.core.getMessage(info.key, (err, doc) => {
          const issuerName = issuer.name || info.by.slice(0, 8)
          const role = doc.content.flags[0]
          const reason = doc.content.reason || ''

          // there was no change in behaviour, e.g. someone modded an already
          // modded person, hid someone that was already hidden
          const changeOccurred = Object.keys(changedRole).filter(r => changedRole[r]).length > 0
          if (!changeOccurred) {
            this._emitUpdate('user-updated', { key: info.id, user })
            return
          }
          const type = doc.type.replace(/^flags\//, '')
          let action, text
          if (['admin', 'mod'].includes(role)) { action = (type === 'add' ? 'added' : 'removed') }
          if (role === 'hide') { action = (type === 'add' ? 'hid' : 'unhid') }
          if (role === 'hide') {
            text = `${issuerName} ${action} ${user.name} ${reason}`
          } else {
            text = `${issuerName} ${action} ${user.name} as ${role} ${reason}`
          }
          const obj = { issuer: info.by, receiver: info.id, role, type, reason }
          this._emitUpdate('user-updated', { key: info.id, user })

          const msg = {
            key: '!status',
            value: {
              timestamp: timestamp(),
              type: 'chat/moderation',
              content: {
                text,
                issuerid: info.by,
                receiverid: info.id,
                role,
                type,
                reason
              }
            }
          }

          // add to !status channel, to have a canonical log of all moderation actions in one place
          this.addStatusMessage(msg, '!status')

          // also add to the currently focused channel, so that the moderation action isn't missed
          if (this.chname !== '!status') {
            this.addStatusMessage(msg)
          }
        })
      })

      this._finish()
    })
  })
}
