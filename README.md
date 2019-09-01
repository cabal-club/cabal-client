# cabal-client
`cabal-client` is a new type of client library for cabal (chat) clients.

The goal: new chat clients can now be implemented using _only_ this library, without having to mess around with
[`cabal-core`](https://github.com/cabal-club/cabal-core/) itself.

Things which this library makes possible:
* consolidates logic common to all chat clients
* leaving and joining of channels
* virtual messages (such as status messages) and virtual channels (currently only the `!status` channel)
* handling multiple cabal instances
* receiving unread notifications and mentions for channels
* resolving of DNS shortnames (cabal.chat) to cabal keys

## Usage
See [`cabal-cli`](https://github.com/cabal-club/cabal-cli/) for an example client implementation.

```js
var Client = require('cabal-client')

const client = new Client({
  maxFeeds: maxFeeds,
  config: {
    dbdir: archivesdir,
    temp: args.temp
  },
  // persistent caching means that we cache resolved DNS shortnames, allowing access to their cabals while offline
  persistentCache: {
    // localCache is something you have to implement yourself
    read: async function (name, err) {
      if (name in config.cache) {
        var cache = localCache[name]
        if (cache.expiresAt < Date.now()) { // if ttl has expired: warn, but keep using
          console.error(`The TTL for ${name} has expired`)
        }
        return cache.key
      }
      // dns record wasn't found online and wasn't in the cache
      return null
    },
    write: async function (name, key, ttl) {
      var expireOffset = +(new Date(ttl * 1000)) // convert to epoch time
      var expiredTime = Date.now() + expireOffset
      if (!localCache) localCache = {}
      localCache[name] = { key: key, expiresAt: expiredTime }
    }
  }
})

client.createCabal()
  .then((cabal) => {
    // resolves when the cabal is ready, returns a CabalDetails instance
  })
```

## Concepts

`cabal-client` has **three core abstractions**:
[`Client`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-cf27c1d543e886c89cd9ac8b8aeaf05b),
[`CabalDetails`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-29fea628f7f8cdba0f19b72b4fb6ba86) and
[`ChannelDetails`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-d4f5ba7622d714169e3279f70bca49a8).

[`Client`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-cf27c1d543e886c89cd9ac8b8aeaf05b) is the
entrypoint. It has a list of `CabalDetails` (one `details` for each joined cabal) as well as an API for interacting with
a cabal (getting a count of the new messages for a channel, the joined channels for the current peer etc).

[`CabalDetails`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-29fea628f7f8cdba0f19b72b4fb6ba86) is the
instance that clients mostly operate on, as it encapsulates all information for a particular cabal. (joined channels,
users in that channel, the topic). **It also emits events.**

When a change has happened, a `CabalDetails` instance will call `this._emitUpdate()`. When a client receives this
event, they should update their state & rerender. (Check out [how the cli does
it](https://github.com/cabal-club/cabal-cli/pull/126).)

[`ChannelDetails`](https://github.com/cabal-club/cabal-client/pull/11/files#diff-d4f5ba7622d714169e3279f70bca49a8)
encapsulates everything channels (mentions in that channel, status messages for the channel (like having called a
command eg `/names`, when it was last read, if it's currently being viewed, if it's joined and so on). It also has a
barebones implementation for virtual channels, which currently is only the `!status` channel.

## API

```js
var Client = require('cabal-client')
```


### var client = Client(opts)

Create a client instance from which to manage multiple [`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.

####  `opts`
```
    {
        // if `temp` is true no data is persisted to disk. 
        // `dbdir` is the directory to store the cabal data
        config: {temp, dbdir}, 
        maxFeeds, // max amount of feeds to sync. default is 1000

        // opts.persistentCache has a read and write function. optional
        //   read: async function ()   // aka cache lookup function
        //   write: async function ()  // aka cache write function
        persistentCache 
    }
```

### `Client.getDatabaseVersion()`

Get the current database version. 

### `Client.scrubKey(key)`

Returns a 64 bit hash if passed in e.g. `cabal://1337..7331` -> `1337..7331`.

### `Client.getCabalDirectory()`

Returns a string path of where all of the cabals are stored on the hard drive.

### `cabalToDetails (cabal = this.currentCabal)`

Returns a `CabalDetails` instance for the passed in `cabal-core` instance.

### `addStatusMessage (message, channel, cabal = this.currentCabal)`

Add a status message, displayed client-side only, to the specified channel and cabal. If no cabal is specified, the currently focused cabal is used. 

### `clearStatusMessages (channel, cabal = this.currentCabal)`

Clear status messages for the specified channel.

### `getUsers (cabal = this.currentCabal)`

Returns a list of all the users for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

### `getChannels (cabal = this.currentCabal)`

Returns a list of all channels for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

### `getJoinedChannels (cabal = this.currentCabal)`

Returns a list of channels the user has joined for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

### client.getUnreadMessages(channel, cb)

Return an array of all unread messages in a channel.

### client.openChannel(channel, cb)

Start watching the channel named `channel`. Its contents default to being 'read'
up until now.

### client.closeChannel(channel, cb)

Stop watching the channel named `channel`.

### client.markChannelRead(channel, cb)

Mark the contents of `channel` up to now as read.

A client will probably call this whenever the user selects a channel to view.

### client.on('message', function (channel, msg) {})

Event fires when a new message arrives since `client` was created. It is not
fired for messages processed in the past.

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install cabal-client
```

## License

AGPL-3.0-or-later
