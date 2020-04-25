var qr = require('qrcode')

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
        if (topic.length > 0 && topic.length > 20) topic = topic.slice(0, 40) + '..'
        var count = cabal.getChannelMembers(c).length
        var userPart = count ? `: ${count} ${count === 1 ? 'person' : 'people'}` : ''
        var topicPart = topic.length > 0 ? ` ${chalk.cyan(topic)}` : ''
        res.info(`  ${joinedChannels.includes(c) ? '*' : ' '} ${c}${userPart}${topicPart}`)
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
  }
}

function cmpUser (a, b) {
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
  return a.key < b.key ? -1 : 1
}
