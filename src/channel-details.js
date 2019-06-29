const collect = require('collect-stream')

class ChannelDetails {
  constructor(cabal, channel) {
    this.name = channel
    this._cabal = cabal
    // todo: mentionsCount / mentionsMessages
    this.newMessageCount = 0
    /* TODO: 
    use cursor to remember scrollback state and fetch 
    from leveldb.  
    maybe store a negative offset to look up?*/
    this.lastRead = 0 /* timestamp in epoch time */
    this.joined = false
    this.opened = false
  }

  toString() {
    return this.name
  }

  handleMessage(message) {
    if (!this.opened) {
      // ++var is an optimization:
      // var++ creates a temporary variable while ++var doesn't
      ++this.newMessageCount
    }
  }
  
  close() {
    this.opened = false
  }

  getNewMessageCount() {
    return this.newMessageCount
  }

  markAsRead() {
    this.lastRead = Date.now()
  }

  open() {
    this.opened = true
    const resp = { newMessageCount: this.newMessageCount, lastRead: this.lastRead }
    this.newMessageCount = 0
    return resp
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

  getPage(limit, lastTimestamp = Date.now()) {
    return new Promise((resolve, reject) => {
      const rs = this._cabal.messages.read(this.name, { limit, lt: lastTimestamp })
      collect(rs, (err, msgs) => {
        if (err) {
          return reject(err)
        }

        resolve(msgs.reverse())
      })
    }) 
  }
}

module.exports = ChannelDetails
