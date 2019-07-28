const collect = require('collect-stream')

class ChannelDetailsBase {
  constructor(channelName) {
    this.name = channelName

    this.mentions = []
    this.virtualMessages = []
    this.newMessageCount = 0
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

  getVirtualMessages(opts) {
    const limit = opts.limit
    const newerThan = opts.gt || 0
    const olderThan = opts.lt || Infinity
    return this.virtualMessages.filter((m) => {
      return (m.value.timestamp > newerThan && m.value.timestamp < olderThan)
    }).slice(-limit)
  }

  interleaveVirtualMessages(messages, opts) {
    const virtualMessages = this.getVirtualMessages(opts)

    if (virtualMessages.length === 0) {
      return messages
    }
    if (messages.length === 0) {
      return virtualMessages
    }

    const limit = opts.limit
    const res = []
    let index = 0
    let virtualIndex = 0
    while (index < messages.length && virtualIndex < virtualMessages.length) {
      const v = virtualMessages[virtualIndex]
      const m = messages[index]
      if (v.value.timestamp <= m.value.timestamp) {
        res.push(v)
        ++virtualIndex
      } else {
        res.push(m)
        ++index
      }
    }
    // push the remaining messages from the incompleted buffer into the result buffer
    if (index === messages.length) {
      res.push(...virtualMessages.slice(virtualIndex))
    } else {
      res.push(...messages.slice(index))
    }
    return res.slice(-limit)
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
        resolve(this.interleaveVirtualMessages(msgs.reverse(), OGopts))
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
