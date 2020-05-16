class User {
  constructor (defaults) {
    defaults = defaults || {}
    this.local = defaults.local === undefined ? false : defaults.local
    this.online = defaults.online === undefined ? false : defaults.online
    this.name = defaults.name === undefined ? '' : defaults.name
    this.key = defaults.key === undefined ? '' : defaults.key
    this.roles = defaults.roles === undefined ? new Map() : defaults.roles
  }

  isAdmin (channel) {
    return (this.roles[channel] === 'admin' || this.roles['@'] === 'admin')
  }

  isModerator (channel) {
    return (this.roles[channel] === 'mod' || this.roles['@'] === 'mod')
  }
}

module.exports = User
