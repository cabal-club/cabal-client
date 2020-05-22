
# cabal-client
`cabal-client` is a new type of client library for cabal chat clients.

New chat clients can be implemented using _only_ this library, without having
to mess around with [`cabal-core`](https://github.com/cabal-club/cabal-core/)
anymore.

Some of its features:
* consolidates logic common to all chat clients
* leaving and joining of channels
* virtual messages (such as status messages) and virtual channels (currently only the `!status` channel)
* handling multiple cabal instances
* receiving unread notifications and mentions for channels
* resolving of DNS shortnames (cabal.chat) to cabal keys

For a couple of brief examples, see the [`examples/`](examples/) directory.

## Usage
See [`cabal-cli`](https://github.com/cabal-club/cabal-cli/) for an example client implementation.

[Read the API documentation](./api.md)

```js
var Client = require('cabal-client')

const client = new Client({
  config: {
    dbdir: '/tmp/cabals'
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

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install cabal-client
```

## License

AGPL-3.0-or-later
