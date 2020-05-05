var qr = require('qrcode')

module.exports = {
  add: {
    help: () => 'add a cabal',
    alias: [ 'cabal' ],
    call: (cabal, res, arg) => {
      if (arg === '') {
        res.info('Usage example: /add <cabalkey>')
        res.data({ command: 'add', arg: arg })
        res.end()
      } else {
        cabal.client.addCabal(arg, (err) => {
          if (err) return res.error(err)
          res.data({ command: 'add', arg: arg })
          res.end()
        })
      }
    }
  },
  new: {
    help: () => 'create a new cabal',
    call: (cabal, res, arg) => {
      cabal.client.createCabal((err) => {
        if (err) return res.error(err)
        res.data({ command: 'help', arg: arg })
        res.end()
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
        res.data({ command: 'nick', arg: arg })
        res.end()
      })
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
        if (err) return res.error(err)
        res.data({ command: 'emote', arg: arg })
        res.end()
      })
    }
  },
  names: {
    help: () => 'display the names of the currently online peers',
    call: (cabal, res, arg) => {
      var users = cabal.getUsers()
      var userkeys = Object.keys(users).map((key) => users[key]).sort(cmpUser)
      res.info('history of peers in cabal cabal')
      userkeys.map((u) => {
        var username = u.name || 'conspirator'
        var spaces = ' '.repeat(15)
        var paddedName = (username + spaces).slice(0, spaces.length)
        res.info(`  ${paddedName} ${u.key}`)
      })
      res.data({
        command: 'names',
        arg: arg,
        data: userkeys.map((u) => u.name || u.key)
      })
      res.end()
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
      res.data({
        command: 'channels',
        arg: arg,
        data: {
          channels: channels,
          joinedChannels: joinedChannels
        }
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
      res.data({ 
        command: 'join',
        arg: arg,
        data: {
          channel: arg
        }
      })
      res.end()
    }
  },
  leave: {
    help: () => 'leave a channel',
    alias: ['l'],
    call: (cabal, res, arg) => {
      if (arg === '!status') return
      /* TODO: update `cabal.channel` with next channel */
      var details = this.cabalToDetails(cabal)
      var currentChannel = details.getCurrentChannel()
      cabal.leaveChannel(arg)
      res.data({ 
        command: 'leave',
        data: {
          channel: arg || currentChannel
        },
        arg: arg
      })
      res.end()
    }
  },
  clear: {
    help: () => 'clear the current backscroll',
    call: (cabal, res, arg) => {
      cabal.client.clearStatusMessages()
      res.data({ command: 'clear', arg: arg })
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
        res.data({ command: 'qr', data: qrcode, arg: arg })
        res.end()
      })
    }
  },
  topic: {
    help: () => 'set the topic/description/`message of the day` for a channel',
    alias: [ 'motd' ],
    call: (cabal, res, arg) => {
      cabal.publishChannelTopic(cabal.channel, arg, (err) => {
        if (err) return res.error(err)
        res.data({ command: 'topic', arg: arg })
        res.end()
      })
    }
  },
  whoami: {
    help: () => 'display your local user key',
    alias: [ 'key' ],
    call: (cabal, res, arg) => {
      const key = cabal.getLocalUser().key
      res.info('Local user key: ' + key)
      res.data({ command: 'whoami', data: key, arg: arg })
      res.end()
    }
  },
  whois: {
    help: () => 'display the public keys associated with the passed in nick',
    call: (cabal, res, arg) => {
      const users = cabal.getUsers()
      const whoisKeys = Object.keys(users).filter((k) => users[k].name && users[k].name === arg)
      res.info(`${arg}'s public keys:`)
      // list all of arg's public keys in list
      for (var key of whoisKeys) {
        res.info(`  ${key}`)
      }
      res.data({ command: 'whois', data: whoisKeys, arg: arg })
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
