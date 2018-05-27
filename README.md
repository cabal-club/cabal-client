# cabal-client

> helper module for cabal clients

There are certain pieces of state that clients seem to need to manage that need
to be stored across sessions but don't belong in the [p2p
database](https://github.com/cabal-club/cabal-node). `cabal-client` handles

- remembering what messages or channels have / have not been read by the user
- remembering what channels the user has open

## Usage

```js
var Cabal = require('cabal')
var Client = require('cabal-client')

var cabal = Cabal(ram, null, {username: 'bob'})
var client = Client(cabal)  // uses system's application directory for data storage

cabal.db.ready(function () {
  client.getOpenChannels(function (err, channels) {
    // channels => ['default', 'cabal-dev']
  })

  client.getUnreadMessages('default', function (err, msgs) {
    // msgs => [ { type: 'text/chat', ... } ]
  })

  client.openChannel('3d-graphics', function (err) {
    // unread state for this channel is now tracked
  })

  client.closeChannel('3d-graphics', function (err) {
    // unread state for this channel is forgotten
  })

  client.markChannelRead('cabal-dev', function (err) {
    // marks all messages in this channel as read
  })
})
```

## API

```js
var Client = require('cabal-client')
```

### var client = Client(cabal[, storage])

Create a client instance over the cabal db `cabal`.

`storage`, if provided, must be a LevelUP or LevelDOWN instance. If not
provided, the system's local application directory for the app 'cabal' is used.

### client.getOpenChannels(cb)

Returns a list of channel names that the user has open. The `default` channel is
open by default.

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

ISC
