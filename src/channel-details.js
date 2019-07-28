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

  interleaveVirtualMessages(messages, opts) {
    const limit = opts.limit
    const newerThan = opts.gt || 0
    const olderThan = opts.lt || Infinity
    const virtualMessages = this.virtualMessages.filter((m) => {
      return (m.value.timestamp > newerThan && m.value.timestamp < olderThan)
    })

    if (virtualMessages.length === 0) {
      return messages
    }

    const res = []
    let index = 0
    let virtualIndex = 0
    while (res.length < limit && index < messages.length && virtualIndex < virtualMessages.length) {
      if (virtualMessages[virtualIndex].value.timestamp <= messages[index].value.timestamp) {
        res.push(this.virtualMessages[virtualIndex++])
      } else {
        res.push(messages[index++])
      }
    }

    if (res.length === limit) {
      return res
    }
    // push the remaining messages from the incompleted buffer into the result buffer
    if (index === messages.length) {
      Array.prototype.push.apply(res, virtualMessages.slice(virtualIndex))
    } else {
      Array.prototype.push.apply(res, messages.slice(index))
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
    // opts.limit = opts.limit || -1
    // opts.lt = opts.lt || Date.now()
    // opts.gt = opts.gt || 0
    return new Promise((resolve, reject) => {
      const rs = this.messages.read(this.name, opts)
      collect(rs, (err, msgs) => {
        if (err) {
          return reject(err)
        }
        resolve(this.interleaveVirtualMessages(msgs.reverse(), opts.limit))
      })
    }) 
  }
}

class VirtualChannelDetails extends ChannelDetailsBase {
  constructor(channelName) {
    super(channelName)
  }

  getPage(opts) {
    const newerThan = opts.gt || 0
    const olderThan = opts.lt || Infinity
    return Promise.resolve(this.virtualMessages.filter((m) => {
      return (m.value.timestamp > newerThan && m.value.timestamp < olderThan)
    }).slice(-opts.limit))
  }
}

module.exports = { ChannelDetails, VirtualChannelDetails }
