class User {
  constructor (defaults) {
    defaults = defaults || {}
    this.local = defaults.local === undefined ? false : defaults.local
    this.online = defaults.online === undefined ? false : defaults.online
    this.name = defaults.name === undefined ? '' : defaults.name
    this.key = defaults.key === undefined ? '' : defaults.key
    this.flags = defaults.flags === undefined ? new Map() : defaults.flags
  }

  isAdmin (channel) {
    return (this.flags[channel] && this.flags[channel].includes('admin'))
      || (this.flags['@'] && this.flags['@'].includes('admin'))
  }

  isModerator (channel) {
    return (this.flags[channel] && this.flags[channel].includes('mod'))
      || (this.flags['@'] && this.flags['@'].includes('mod'))
  }
}

module.exports = User
