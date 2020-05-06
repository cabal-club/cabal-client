const qr = require('qrcode')
const pump = require('pump')
const to = require('to2')

module.exports = {
  add: {
    help: () => 'add a cabal',
    alias: [ 'cabal' ],
    call: (cabal, res, arg) => {
      if (arg === '') {
        res.info('Usage example: /add <cabalkey>')
        res.end()
      } else {
        cabal.client.addCabal(arg, (err) => {
          if (err) res.error(err)
          else res.end()
        })
      }
    }
  },
  new: {
    help: () => 'create a new cabal',
    call: (cabal, res, arg) => {
      cabal.client.createCabal((err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  nick: {
    help: () => 'change your display name',
    alias: [ 'n' ],
    call: (cabal, res, arg) => {
      if (arg === '') {
        res.info(cabal.user.name)
        return res.end()
      }
      cabal.publishNick(arg, (err) => {
        if (err) return res.error(err)
        res.info("you're now known as " + arg)
        res.end()
      })
    }
  },
  ids: {
    help: () => 'toggle showing ids at the end of nicks. useful for moderation',
    call: (cabal, res, arg) => {
        cabal.showIds = !cabal.showIds
        res.info(`toggled identifiers ${cabal.showIds ? "on" : "off"}`)
        res.end()
    }
  },
  emote: {
    help: () => 'write an old-school text emote',
    alias: [ 'me' ],
    call: (cabal, res, arg) => {
      cabal.publishMessage({
        type: 'chat/emote',
        content: {
          channel: cabal.channel,
          text: arg
        }
      }, {}, (err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  names: {
    help: () => 'display the names of the currently online peers',
    call: (cabal, res, arg) => {
      var users = cabal.getUsers()
      var userkeys = Object.keys(users).map((key) => users[key]).sort(cmpUser)
      res.info('history of peers in cabal')
      userkeys.map((u) => {
        var username = u.name || 'conspirator'
        var spaces = ' '.repeat(15)
        var paddedName = (username + spaces).slice(0, spaces.length)
        res.info(`  ${paddedName} ${u.key}`)
      })
    }
  },
  channels: {
    help: () => "display the cabal's channels",
    call: (cabal, res, arg) => {
      var joinedChannels = cabal.getJoinedChannels()
      var channels = cabal.getChannels()
      res.info(`there are currently ${channels.length} channels `)
      channels.map((c) => {
        var topic = cabal.getTopic(c)
        var shortTopic = topic.length > 20 ? topic.slice(0, 40) + '..' : topic || ''
        var count = cabal.getChannelMembers(c).length
        var userPart = count ? `: ${count} ${count === 1 ? 'person' : 'people'}` : ''
        res.info({
          text: `  ${joinedChannels.includes(c) ? '*' : ' '} ${c}${userPart}${shortTopic}`,
          channel: c,
          userCount: count,
          topic,
          joined: joinedChannels.includes(c)
        })
      })
      res.end()
    }
  },
  join: {
    help: () => 'join a new channel',
    alias: ['j'],
    call: (cabal, res, arg) => {
      if (arg === '') arg = 'default'
      cabal.joinChannel(arg)
      cabal.focusChannel(arg)
      res.end()
    }
  },
  leave: {
    help: () => 'leave a channel',
    alias: ['l'],
    call: (cabal, res, arg) => {
      if (arg === '!status') return
      /* TODO: update `cabal.channel` with next channel */
      cabal.leaveChannel(arg)
      res.end()
    }
  },
  clear: {
    help: () => 'clear the current backscroll',
    call: (cabal, res, arg) => {
      cabal.client.clearStatusMessages()
      res.end()
    }
  },
  qr: {
    help: () => "generate a qr code with the current cabal's address",
    call: (cabal, res, arg) => {
      const cabalKey = `cabal://${cabal.key}`
      qr.toString(cabalKey, { type: 'terminal' }, (err, qrcode) => {
        if (err) return
        res.info(`QR code for ${cabalKey}\n\n${qrcode}`)
        res.end()
      })
    }
  },
  topic: {
    help: () => 'set the topic/description/`message of the day` for a channel',
    alias: [ 'motd' ],
    call: (cabal, res, arg) => {
      cabal.publishChannelTopic(cabal.channel, arg, (err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  whoami: {
    help: () => 'display your local user key',
    alias: [ 'key' ],
    call: (cabal, res, arg) => {
      res.info('Local user key: ' + cabal.getLocalUser().key)
      res.end()
    }
  },
  whois: {
    help: () => 'display the public keys associated with the passed in nick',
    call: (cabal, res, arg) => {
      if (!arg) {
        res.info(`usage: /whois <nick>`)
        res.end()
        return
      }
      const users = cabal.getUsers()
      const whoisKeys = Object.keys(users).filter((k) => users[k].name && users[k].name === arg)
      res.info(`${arg}'s public keys:`)
      // list all of arg's public keys in list
      for (var key of whoisKeys) {
        res.info(`  ${key}`)
      }
      res.end()
    }
  },
  hide: {
    help: () => 'hide a user from a channel or the whole cabal',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) { 
        res.info('usage: /hide (CHANNEL|@) KEY {REASON...}')
        return res.end()
      }
      let key = null
      let channel = "@"
      // allow a simple form of /hide <key>. defaults to no reason & cabal-wide
      if (args.length === 1) {
        key = args[0]
      } else {
        channel = args[0]
        key = args[1]
      }
      // allow user.pubkey notation
      if (key && key.length !== 64 && key.indexOf(".") >= 0) {
        key = getFullKey(cabal, key.split(".")[1])
      }
      cabal.core.ban(key, {
        channel,
        reason: args.slice(2).join(' ')
      }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info("the peer has been hidden")
          res.end()
        }
      })
    }
  },
  unhide: {
    help: () => 'unhide a user from a channel or the whole cabal',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) { 
        res.info('usage: /unhide (CHANNEL|@) KEY {REASON...}')
        return res.end()
      }
      let key = null
      let channel = "@"
      // allow a simple form of /unhide <key>. defaults to no reason & cabal-wide
      if (args.length === 1) {
        key = args[0]
      } else {
        channel = args[0]
        key = args[1]
      }
      // allow user.pubkey notation
      if (key && key.length !== 64 && key.indexOf(".") >= 0) {
        key = getFullKey(cabal, key.split(".")[1])
      }
      cabal.core.unban(key, {
        channel,
        reason: args.slice(2).join(' ')
      }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info(`${getPeerName(cabal, key)} has been unhidden`)
          res.end()
        }
      })
    }
  },
  baninfo: {
    help: () => 'show information about a ban from a KEY@SEQ (use /banlist to obtain)',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) { 
        res.info('usage: /baninfo KEY@SEQ')
        return res.end()
      }
      cabal.core.moderation.banInfo(args[0], function (err, doc) {
        if (err) return res.error(err)
        res.info(Object.assign({}, doc, {
          text: JSON.stringify(doc, 2, null)
        }))
        res.end()
      })
    }
  },
  banlist: {
    help: () => 'list banned users per-channel or cabal-wide',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      var channel = args[0] || '@'
      pump(cabal.core.moderation.listBans(channel), to.obj(write, end))
      function write (row, enc, next) {
        res.info(Object.assign({}, row, {
          text: `banned ${row.type}: ${getPeerName(cabal, row.id)}`
        }))
        next()
      }
      function end (next) {
        res.end()
        next()
      }
    }
  },
  role: {
    help: () => 'direct access to get/set roles used by ban and moderation commands',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) { 
        res.info('usage: /role (get|set) (CHANNEL|@) KEY')
        return res.end()
      }
      var channel = args[1]
      var key = args[2]
      if (args[0] === 'get') {
        cabal.core.moderation.getRole({ channel, key }, (err, role) => {
          if (err) return res.error(err)
          res.info({ role, text: role })
          res.end()
        })
      } else {
        res.error('not implemented')
      }
    }
  },
  mod: {
    help: () => 'add, remove, or list moderators',
    call: (cabal, res, arg) => {
      function usage () {
        res.info('usage: /mod (add|remove) KEY {REASON...}')
        res.info('usage: /mod list')
        res.end()
      }
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) {
        return usage()
      }
      var channel = '@' // experiment with only setting moderators cabal-wide
      var key = args[1]
      // allow user.pubkey notation
      if (key && key.length !== 64 && key.indexOf(".") >= 0) {
        key = getFullKey(cabal, key.split(".")[1])
      }
      var reason = args.slice(2).join(' ')
      if (args[0] === 'add') {
        cabal.core.addMod(key, { channel, reason }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info(`${getPeerName(cabal, key)} has been added as a moderator`)
          res.end()
        }
        })
      } else if (args[0] === 'remove') {
        cabal.core.removeMod(key, { channel, reason }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info(`${getPeerName(cabal, key)} has been removed from being a moderator`)
          res.end()
        }
        })
      } else if (args[0] == 'list') {
        pump(cabal.core.moderation.listMods(channel), to.obj(write, end))
      } else {
        usage()
      }
      function write (row, enc, next) {
        res.info(Object.assign({}, row, {
          text: `${getPeerName(cabal, row.id)} [${row.role}]`
        }))
        next()
      }
      function end (next) {
        res.end()
        next()
      }
    }
  },
  admin: {
    help: () => 'add or remove an admin cabal-wide',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) {
        res.info('usage: /admin (add|remove) KEY {REASON...}')
        res.info('usage: /admin list')
        return res.end()
      }
      var channel = '@' // experiment with only setting administrators cabal-wide
      var key = args[1]
      // allow user.pubkey notation
      if (key && key.length !== 64 && key.indexOf(".") >= 0) {
        key = getFullKey(cabal, key.split(".")[1])
      }
      var reason = args.slice(2).join(' ')
      if (args[0] === 'add') {
        cabal.core.addAdmin(key, { channel, reason }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info(`${getPeerName(cabal, key)} has been added as an administrator`)
          res.end()
        }
        })
      } else if (args[0] === 'remove') {
        cabal.core.removeAdmin(key, { channel, reason }, (err) => {
        if (err) { res.error(err) }
        else {
          res.info(`${getPeerName(cabal, key)} has been removed from being an administrator`)
          res.end()
        }
        })
      } else if (args[0] == 'list') {
        pump(cabal.core.moderation.listAdmins(channel), to.obj(write, end))
      } else {
        res.error(usage)
      }
      function write (row, enc, next) {
        res.info(Object.assign({}, row, {
          text: `${getPeerName(cabal, row.id)}`
        }))
        next()
      }
      function end (next) {
        res.end()
        next()
      }
    }
  },
}

function getFullKey (details, key) {
  const keys = Object.keys(details.getUsers())
  return keys.filter((k) => k.startsWith(key))[0]
}

function getPeerName (details, key) {
  const users = details.getUsers()
  if (key in users) {
    return users[key].name || key
  }
  return key
}

function cmpUser (a, b) {
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
  return a.key < b.key ? -1 : 1
}
