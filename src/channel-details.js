const collect = require('collect-stream')
const { stableSort, merge } = require('./util')

class ChannelDetailsBase {
  constructor(channelName) {
    this.name = channelName

    this.mentions = []
    this.virtualMessages = []
    this.newMessageCount = 0
    this.datesSeen = new Set()
    /* TODO: 
    use cursor to remember scrollback state and fetch 
    from leveldb.  
    maybe store a negative offset to look up?*/
    this.lastRead = 0 /* timestamp in epoch time */
    this.joined = false
    this.opened = false
    this.topic = ''
  }

  toString() {
    return this.name
  }

  addMention(mention) {
    if (!this.opened) {
      this.mentions.push(mention)
    }
  }

  getMentions() {
    return this.mentions.slice() // return copy
  }

  handleMessage(message) {
    if (!this.opened) {
      // ++var is an optimization:
      // var++ creates a temporary variable while ++var doesn't
      ++this.newMessageCount
    }
  }
  
  getNewMessageCount() {
    return this.newMessageCount
  }

  markAsRead() {
    this.lastRead = Date.now()
    this.newMessageCount = 0
    this.mentions = []
  }

  open() {
    this.opened = true
  }

  close() {
    this.opened = false
  }

  clearVirtualMessages () {
    this.virtualMessages = []
  }

  getVirtualMessages(opts) {
    const limit = opts.limit
    const newerThan = opts.gt || 0
    const olderThan = opts.lt || Infinity
    var filtered = this.virtualMessages.filter((m) => {
      return (m.value.timestamp > newerThan && m.value.timestamp < olderThan)
    })
    return stableSort(filtered, v => v.value.timestamp).slice(-limit)
  }

  interleaveVirtualMessages(messages, opts) {
    const virtualMessages = this.getVirtualMessages(opts)
    var cmp = (a, b) => parseInt(a.value.timestamp) - parseInt(b.value.timestamp)
    return virtualMessages.concat(messages).sort(cmp).slice(-opts.limit)
  }

  /*
  addMessage({ timestamp: Date.now(), type: "status", text: "" }})
  */
  addMessage(msg) {
    /*
    msg will be on the format of
    {timestamp, type, text} 
    but we convert it to the format that cabal expects messages to conform to 
     msg = {
       key: ''
       value: {
         timestamp: ''
         type: ''
         content: {
           text: ''
         }
       }
     }
     */
     if (!msg.value) {
       msg = {
         key: this.name,
         value: {
           timestamp: msg.timestamp || Date.now(),
           type: msg.type || "status",
           content: {
             text: msg.text
           }
         }
       }
     }
     this.virtualMessages.push(msg)
   }

  // returns false if we were already in the channel, otherwise true
  join() {
    var joined = this.joined
    this.joined = true
    return joined
  }

  // returns true if we were previously in the channel, otherwise false
  leave() {
    var joined = this.joined
    this.joined = false
    return joined
  }
}
/*
msg = {
  key: '' // dunno
  value: {
    timestamp: '' // dunno
    type: 'status/date-change'
    content: {
      time: '<epochtime>'
    }
  }
}
*/

class ChannelDetails extends ChannelDetailsBase {
  constructor(cabal, channelName) {
    super(channelName)
    this.messages = cabal.messages
  }

  getPage(opts) {
    opts = opts || {}
    const OGopts = Object.assign({}, opts)
    return new Promise((resolve, reject) => {
      const rs = this.messages.read(this.name, opts)
      collect(rs, (err, msgs) => {
        if (err) {
          return reject(err)
        }
        const reversed = []
        for (let i = msgs.length - 1; i >= 0; --i) {
          const msg = msgs[i]
          reversed.push(msg)
          const msgTime = msg.value.timestamp
          const dayTimestamp = msgTime - (msgTime % (24*60*60*1000))
          if (!this.datesSeen.has(dayTimestamp)) {
            this.datesSeen.add(dayTimestamp)
            this.addMessage({
              key: this.name,
              value: {
                timestamp: dayTimestamp,
                type: 'status/date-changed'
              }
            })
          }
        }
        resolve(this.interleaveVirtualMessages(reversed, OGopts))
      })
    }) 
  }
}

class VirtualChannelDetails extends ChannelDetailsBase {
  constructor(channelName) {
    super(channelName)
  }

  getPage(opts) {
    return Promise.resolve(this.getVirtualMessages(opts))
  }
}

module.exports = { ChannelDetails, VirtualChannelDetails }
