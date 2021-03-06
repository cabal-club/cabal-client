class User {
  constructor (defaults) {
    defaults = defaults || {}
    this.local = defaults.local === undefined ? false : defaults.local
    this.online = defaults.online === undefined ? false : defaults.online
    this.name = defaults.name === undefined ? '' : defaults.name
    this.key = defaults.key === undefined ? '' : defaults.key
    this.flags = defaults.flags === undefined ? new Map() : defaults.flags
  }

  isHidden (channel) {
    const chan = this.flags.get(channel)
    const all = this.flags.get('@')
    return (chan && chan.includes('hide')) || (all && all.includes('hide'))
  }

  isAdmin (channel) {
    const chan = this.flags.get(channel)
    const all = this.flags.get('@')
    return (chan && chan.includes('admin')) || (all && all.includes('admin'))
  }

  isModerator (channel) {
    const chan = this.flags.get(channel)
    const all = this.flags.get('@')
    return (chan && chan.includes('mod')) || (all && all.includes('mod'))
  }

  canModerate(channel) {
    return this.isAdmin(channel) || this.isModerator(channel)
  }

}

module.exports = User
