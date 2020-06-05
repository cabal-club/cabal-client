const pump = require('pump')
const to = require('to2')

class Moderation {
  constructor (core) { 
    this.core = core
  }

  getAdmins (channel) {
    return this._listCmd('admin', channel)
  }

  getMods (channel) {
    return this._listCmd('mod', channel)
  }

  getHides (channel) {
    return this._listCmd('hide', channel)
  }

  getBlocks (channel) {
    return this._listCmd('block', channel)
  }

  hide (id, opts) {
    opts = opts || {}
    return this.setFlag('hide', 'add', opts.channel, id, opts.reason)
  }

  unhide (id, opts) {
    opts = opts || {}
    return this.setFlag('hide', 'remove', opts.channel, id, opts.reason)
  }

  block (id, opts) {
    opts = opts || {}
    return this.setFlag('block', 'add', opts.channel, id, opts.reason)
  }

  unblock (id, opts) {
    opts = opts || {}
    return this.setFlag('block', 'remove', opts.channel, id, opts.reason)
  }

  addAdmin (id, opts) {
    opts = opts || {}
    return this.setFlag('admin', 'add', opts.channel, id, opts.reason)
  }

  removeAdmin (id, opts) {
    opts = opts || {}
    return this.setFlag('admin', 'remove', opts.channel, id, opts.reason)
  }

  addMod (id, opts) {
    opts = opts || {}
    return this.setFlag('mod', 'add', opts.channel, id, opts.reason)
  }

  removeMod (id, opts) {
    opts = opts || {}
    return this.setFlag('mod', 'remove', opts.channel, id, opts.reason)
  }

  setFlag (flag, type, channel='@', id, reason='') {
    // a list of [[id, reason]] was passed in
    if (typeof id[Symbol.iterator] === 'function') {
      const promises = id.map((entry) => { return this._flagCmd(flag, type, channel, entry[0], entry[1]) })
      return Promise.all(promises)
    }
    return this._flagCmd(flag, type, id, channel, reason)
  }

  _flagCmd (flag, type, channel='@', id, reason='') {
    const fname = (type === 'add' ? 'addFlags' : 'removeFlags')
    return new Promise((resolve, reject) => {
      this.core.moderation[fname]({
        id,
        channel,
        flags: [flag],
        reason
      }, (err) => {
        if (err) { return reject(err) }
        else { resolve() }
      })
    })
  }

  _listCmd (cmd, channel='@') {
    const keys = []
    return new Promise((resolve, reject) => {
      const write = (row, enc, next) => {
        keys.push(row.id)
        next()
      }
      const end = (next) => {
        next()
        resolve(keys)
      }
      pump(
        this.core.moderation.listByFlag({ flag: cmd, channel }),
        to.obj(write, end)
      )
    })
  }
}

module.exports = Moderation
