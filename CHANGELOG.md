# Changelog

## [7.3.0] - 2022-05-24

### Changed

- Use getter for PMChannelDetails.joined ([#89](https://github.com/cabal-club/cabal-client/issues/89)) (Daniel Chiquito).

  The getter refers to the CabalDetails instance which holds the settings
  for the cabal to determine if the private message channel should be
  considered joined or not.

  This has the side affect of requiring the CabalDetails when initializing
  the PMChannelDetails, which involves changing the constructor signature.

  This is technically a breaking change, however `ChannelDetails` is an internal implementation concern of
  cabal-details and not intended to be one of the public facing api functions.

### Added

- Add methods to read/write a settings file ([#89](https://github.com/cabal-club/cabal-client/issues/89)) (Daniel Chiquito)
- Add dependency on js-yaml ([#89](https://github.com/cabal-club/cabal-client/issues/89)) (Daniel Chiquito)
- Leaving private messages functionality ([#89](https://github.com/cabal-club/cabal-client/issues/89)) (Daniel Chiquito & cblgh)

### Fixed

- Potential issue upstream in cabal-core when receiving ill-formatted PMs ([`e6e7308`](https://github.com/cabal-club/cabal-client/commit/e6e7308)) (cblgh)

## [7.2.2] - 2021-12-16

### Fixed

- remove duplication of channel events ([`0caff38`](https://github.com/cabal-club/cabal-client/commit/0caff38)) ([**@khubo**](https://github.com/khubo))

## [7.2.1] - 2021-12-11

### Changed

- getChannels: add onlyJoined param ([`1bb9d3d`](https://github.com/cabal-club/cabal-client/commit/1bb9d3d)) ([**@cblgh**](https://github.com/cblgh))

## [7.2.0] - 2021-11-23

### Changed

- bump cabal-core to 15.0.0 (only changes were to pm api) ([#82](https://github.com/cabal-club/cabal-client/issues/82)) ([**@cblgh**](https://github.com/cblgh))
- disallow channel names == hypercore key, support latest core pm format ([#82](https://github.com/cabal-club/cabal-client/issues/82)) ([**@cblgh**](https://github.com/cblgh))
  - A new convention was introduced to limit malicious use in clients: Channel names conforming to the hypercore public key format are forbidden in cabal-client as names for regular channel names (i.e. no channel names that are 64 hex characters)—these are restricted to private channels only (namely: one per person you are chatting with, the name being their public key (or yours, from their perspective))
- Revert "only add message listener when we're adding a new channel" ([`1bf10a9`](https://github.com/cabal-club/cabal-client/commit/1bf10a9)) ([**@cblgh**](https://github.com/cblgh)).

  This reverts commit [`1dbd522`](https://github.com/cabal-club/cabal-client/commit/1dbd5227923aa9063b93b57cfa9dbed31e246dda).

  It seems this commit introduced a regression in functionality such that
  messages do not appear in channels
  ([#78](https://github.com/cabal-club/cabal-client/issues/78)) and might also be
  responsible for a similar bug in [cabal-desktop@6.0.8](mailto:cabal-desktop@6.0.8)

  It would be good to only add the relevant message listeners, instead of
  duplicates, but I think it will have to be done anew with fresh eyes.

### Added

Adds support for [cabal-core's private message](https://github.com/cabal-club/cabal-core/#private-messages):

- a new `CabalDetails.publishPrivateMessage` function has been added
- `CabalDetails.getPrivateMessageList` returns a list of channel names corresponding to ongoing PMs for the local user
- `CabalDetails.isChannelPrivate(channel)` returns true if the passed in channel is a private message channel, false otherwise
- `CabalDetails.publishMessage` now redirects a published message to `publishPrivateMessage` if it is used to post a message to a private message channel
- `publish-private-message`, `private-message` events are now emitted
- the `PMChannelDetails` has been added to enable support for private message channels with minimal duplicated functionality
- `CabalDetails.getChannels(opts)` was extended with an option `includePM` to include private message channels in the returned result
- PMs are moderation aware: if you hide a user the channel is hidden and no subsequent PMs will be displayed in your client

For more information, see the [API documentation](https://github.com/cabal-club/cabal-client/blob/master/api.md).

## [7.1.0] - 2021-10-23

### Changed

- bump cabal-core to version with hyperswarm-web ([`a83493d`](https://github.com/cabal-club/cabal-client/commit/a83493d)) ([**@cblgh**](https://github.com/cblgh))

### Added

- make cabal-client work in the browser ([`3f7b9d3`](https://github.com/cabal-club/cabal-client/commit/3f7b9d3aa90c6eab80be1796f777d0926e664516)) ([**@cblgh**](https://github.com/cblgh))

### Fixed

- Update Client() docs with opts.aliases and opts.commands ([#81](https://github.com/cabal-club/cabal-client/issues/81)) ([**@ralphtheninja**](https://github.com/ralphtheninja))

## [7.0.0] - 2021-09-26

_The updated version of `cabal-core` indirectly contains major changes to the underlying protocol. See the release of [`cabal-core@14.0.0`](https://github.com/cabal-club/cabal-core/blob/master/CHANGELOG.md#1400---2021-05-18) for more detailed information._

### Changed

- **Breaking:** upgrade `cabal-core` to `14.x` ([#79](https://github.com/cabal-club/cabal-client/issues/79)) (Lars-Magnus Skog)

## [6.3.2] - 2021-05-01

_This is not the first version, but the first version in this changelog to save some time._

[7.3.0]: https://github.com/cabal-club/cabal-client/compare/v7.2.2...v7.3.0

[7.2.2]: https://github.com/cabal-club/cabal-client/compare/v7.2.1...v7.2.2

[7.2.1]: https://github.com/cabal-club/cabal-client/compare/v7.2.0...v7.2.1

[7.2.0]: https://github.com/cabal-club/cabal-client/compare/v7.1.0...v7.2.0

[7.1.0]: https://github.com/cabal-club/cabal-client/compare/v7.0.0...v7.1.0

[7.0.0]: https://github.com/cabal-club/cabal-client/compare/v6.3.2...v7.0.0

[6.3.2]: https://github.com/cabal-club/cabal-client/releases/tag/v6.3.2
