
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
      if (name in localCache) {
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
[`Client`](https://github.com/cabal-club/cabal-client/blob/master/src/client.js),
[`CabalDetails`](https://github.com/cabal-club/cabal-client/blob/master/src/cabal-details.js) and
[`ChannelDetails`](https://github.com/cabal-club/cabal-client/blob/master/src/channel-details.js).

[`Client`](https://github.com/cabal-club/cabal-client/blob/master/src/client.js) is the
entrypoint. It has a list of `CabalDetails` (one `details` for each joined cabal) as well as an API for interacting with
a cabal (getting a count of the new messages for a channel, the joined channels for the current peer etc).

[`CabalDetails`](https://github.com/cabal-club/cabal-client/blob/master/src/cabal-details.js) is the
instance that clients mostly operate on, as it encapsulates all information for a particular cabal. (joined channels,
users in that channel, the topic). **It also emits events.**

When a change has happened, a `CabalDetails` instance will call `this._emitUpdate()`. When a client receives this
event, they should update their state & rerender. (Check out [how the cli does
it](https://github.com/cabal-club/cabal-cli/pull/126).)

[`ChannelDetails`](https://github.com/cabal-club/cabal-client/blob/master/src/channel-details.js)
encapsulates everything channels (mentions in that channel, status messages for the channel (like having called a
command eg `/names`, when it was last read, if it's currently being viewed, if it's joined and so on). It also has a
barebones implementation for virtual channels, which currently is only the `!status` channel.

## API

```js
var Client = require('cabal-client')
```

### `client.js` methods
#### `var client = new Client(opts)`

Create a client instance from which to manage multiple [`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.

#####  `opts`
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

**Note:** If a method is written with a capitalized Client e.g. `Client.scrubKey(key)` it is a [static method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static).

#### `Client.getDatabaseVersion()`

Get the current database version. 

#### `Client.scrubKey(key)`

Returns a 64 bit hash if passed in e.g. `cabal://1337..7331` -> `1337..7331`.

#### `Client.getCabalDirectory()`

Returns a string path of where all of the cabals are stored on the hard drive.


#### `client.resolveName (name, cb)`

Resolve the DNS shortname `name`. If `name` is already a cabal key, it will be returned and the DNS lookup is
aborted.

Returns the cabal key in `cb`. If `cb` is null a Promise is returned.


#### `client.createCabal ()`

Create a new cabal. Returns a promise that resolves into a `CabalDetails` instance.

#### `client.addCabal (key, cb)`

Add/load the cabal at `key`. Returns a promise that resolves into a `CabalDetails` instance. `cb` is called when the
cabal has been initialized.

#### `client.focusCabal (key)`

Focus the cabal at `key`, used when you want to switch from one open cabal to another.

#### `client.removeCabal (key)`

Remove the cabal `key`. Destroys everything related to it (the data is however still persisted to disk, fret not!).

#### `client.getMessages (opts, cb, cabal = this.currentCabal)`
Returns a list of messages according to `opts`. If `cb` is null, a Promise is returned.

##### `opts` 
```
    opts.olderThan // timestamp in epoch time. we want to get messages that are *older* than this ts
    opts.newerThan // timestamp in epoch time. we want to get messages that are *newer* than this ts
    opts.amount // amount of messages to get
    opts.channel // channel to get messages from. defaults to currently focused channel
```

#### `client.getCabalKeys ()`

Returns a list of cabal keys, one for each open cabal.

#### `client.getCurrentCabal ()`

Get the current cabal. Returns a `CabalDetails` instance.

#### `client._getCabalByKey (key)`

Returns the `cabal-core` instance corresponding to the cabal key `key`. `key` is scrubbed internally.

#### `client.cabalToDetails (cabal = this.currentCabal)`

Returns a `CabalDetails` instance for the passed in `cabal-core` instance.

#### `client.addStatusMessage (message, channel, cabal = this.currentCabal)`

Add a status message, displayed client-side only, to the specified channel and cabal. If no cabal is specified, the currently focused cabal is used. 

#### `client.getNumberUnreadMessages (channel, cabal = this.currentCabal)`

Returns the number of unread messages for `channel`.

#### `client.getNumberMentions (channel, cabal = this.currentCabal)`

Returns the number of mentions in `channel`.

#### `client.getMentions (channel, cabal = this.currentCabal)`

Returns a list of messages that triggered a mention in channel.

#### `client.focusChannel (channel, keepUnread = false, cabal = this.currentCabal)`

Focus a channel. This clears the read state unless `keepUnread` is set to true. Emits an update.

#### `client.unfocusChannel (channel, newChannel, cabal = this.currentCabal)`

Unfocus a channel, effectively closing it. If `newChannel` is specified, it will be opened instead. Usually, what you do
is you just use `focusChannel`, as that handles closing of the previously open channel for you.

#### `client.clearStatusMessages (channel, cabal = this.currentCabal)`

Clear status messages for the specified channel.

#### `client.getUsers (cabal = this.currentCabal)`

Returns a list of all the users for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

#### `client.getChannels (cabal = this.currentCabal)`

Returns a list of all channels for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

#### `client.getJoinedChannels (cabal = this.currentCabal)`

Returns a list of channels the user has joined for the specified cabal. If no cabal is specified, the currently focused cabal is used. 

#### `client.getCurrentChannel ()`

Returns the currently focused channel name.

#### `client.subscribe (listener, cabal = this.currentCabal)`

Add a new listener for the `update` event.

#### `client.unsubscribe (listener, cabal = this.currentCabal)`

Remove a previously added listener.

#### `client.markChannelRead (channel, cabal = this.currentCabal)`

Mark the channel as read.

---

### `CabalDetails` methods
Any method that returns an instance of `CabalDetails` will have the following methods.

#### `publishMessage(msg, opts, cb)`
Publish a message. See [`cabal-core`](https://github.com/cabal-club/cabal-core/) for the full list of options.

#### `publishNick(nick, cb)`
Announce a new nickname.

#### `publishChannelTopic(channel=this.chname, topic, cb)`
Publish a new channel topic to `channel`. `cb` is called when publishing has finished.

#### `getTopic(channel=this.chname)`
Returns the current topic of `channel` as a string.

#### `getChannelMembers(channel=this.chname)`

Return the list of user that have joined `channel`. Note: this can be a subset of all of the users in a cabal.

#### `focusChannel(channel=this.chname, keepUnread=false)`
View `channel`, closing the previously focused channel.

#### `unfocusChannel(channel=this.chname, newChannel)`
Close `channel`.

#### `addStatusMessage(message, channel=this.chname)`
Add a status message, visible locally only.

#### `getChannels()`
Returns a list of all the channels in this cabal.

#### `getCurrentChannel()`
Get the name of the current channel

#### `clearVirtualMessages(channel=this.chname)`
Remove all of the virtual (i.e. status) messages associated with this channel. Virtual messages are local only.

#### `getJoinedChannels()`
Returns a list of all of the channel names the user has joined.

#### `getLocalUser()`
Get your user for this cabal. Returns an object containing:
```
{
    local: true,
    online: true,
    name: '',
    key: ''
}
```

#### `getLocalName()`
Get the user's name in this cabal.

#### `joinChannel(channel)`
Join a channel. This is distinct from focusing a channel, as this actually tracks changes and publishes a message
announcing that you have joined the channel

#### `leaveChannel(channel)`
Leave a joined channel. This publishes a message announcing that you have left the channel.

#### `getUsers()`
Returns an JSON object of all of the users in this cabal. Each key is the public key of its corresponding user.

#### `details.on('update', cb)`
The event emitted when anything has changed with this instance of `CabalDetails`. You will typically want to rerender when it has been emitted.

#### `_destroy ()`
Destroy all of the listeners associated with this details instance


## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install cabal-client
```

## License

AGPL-3.0-or-later
