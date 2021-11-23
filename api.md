## Classes

<dl>
<dt><a href="#Client">Client</a></dt>
<dd></dd>
<dt><a href="#CabalDetails">CabalDetails</a></dt>
<dd></dd>
</dl>

<a name="Client"></a>

## Client

* [Client](#Client)
    * [new Client([opts])](#new_Client_new)
    * _instance_
        * [.resolveName(name, [cb])](#Client+resolveName)
        * [.createCabal()](#Client+createCabal) ⇒ <code>Promise</code>
        * [.addCabal(key, opts, cb)](#Client+addCabal) ⇒ <code>Promise</code>
        * [.focusCabal(key)](#Client+focusCabal)
        * [.removeCabal(key, cb)](#Client+removeCabal)
        * [.getDetails()](#Client+getDetails) ⇒ [<code>CabalDetails</code>](#CabalDetails)
        * [.getCabalKeys()](#Client+getCabalKeys) ⇒ <code>Array.&lt;string&gt;</code>
        * [.getCurrentCabal()](#Client+getCurrentCabal) ⇒ [<code>CabalDetails</code>](#CabalDetails)
        * [.addCommand([name], [cmd])](#Client+addCommand)
        * [.removeCommand([name])](#Client+removeCommand)
        * [.getCommands()](#Client+getCommands)
        * [.addAlias([longCmd], [shortCmd])](#Client+addAlias)
        * [.cabalToDetails([cabal])](#Client+cabalToDetails) ⇒ [<code>CabalDetails</code>](#CabalDetails)
        * [.addStatusMessage(message, channel, [cabal])](#Client+addStatusMessage)
        * [.clearStatusMessages(channel, [cabal])](#Client+clearStatusMessages)
        * [.getUsers([cabal])](#Client+getUsers) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getJoinedChannels([cabal])](#Client+getJoinedChannels) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getChannels([cabal])](#Client+getChannels) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.subscribe(listener, [cabal])](#Client+subscribe)
        * [.unsubscribe(listener, [cabal])](#Client+unsubscribe)
        * [.getMessages([opts], [cb], [cabal])](#Client+getMessages)
        * [.searchMessages([searchString], [opts], [cabal])](#Client+searchMessages) ⇒ <code>Promise</code>
        * [.getNumberUnreadMessages(channel, [cabal])](#Client+getNumberUnreadMessages) ⇒ <code>number</code>
        * [.getNumberMentions([channel], [cabal])](#Client+getNumberMentions)
        * [.getMentions([channel], [cabal])](#Client+getMentions)
        * [.focusChannel([channel], [keepUnread], [cabal])](#Client+focusChannel)
        * [.unfocusChannel([channel], [newChannel], [cabal])](#Client+unfocusChannel)
        * [.getCurrentChannel()](#Client+getCurrentChannel) ⇒ <code>string</code>
        * [.markChannelRead(channel, [cabal])](#Client+markChannelRead)
    * _static_
        * [.getDatabaseVersion()](#Client.getDatabaseVersion) ⇒ <code>string</code>
        * [.generateKey()](#Client.generateKey) ⇒ <code>string</code>
        * [.scrubKey(key)](#Client.scrubKey) ⇒ <code>string</code>
        * [.getCabalDirectory()](#Client.getCabalDirectory) ⇒ <code>string</code>


* * *

<a name="new_Client_new"></a>

### new Client([opts])
Create a client instance from which to manage multiple
[`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.

**Params**

- *opts* <code>object</code>
    - aliases <code>object</code> - key/value pairs of `alias` -> `command name`
    - commands <code>object</code> - key/value pairs of `command name` -> `command object`, which has the following properties:
        - call <code>function</code> - command function with the following signature `command.call(cabal, res, arg)`
        - help <code>function</code> - return the help string for this command
        - category <code>Array.&lt;string&gt;</code> - a list of categories this commands belongs to
        - alias <code>Array.&lt;string&gt;</code> - a list of command aliases
    - config <code>object</code>
        - temp <code>boolean</code> - if `temp` is true no data is persisted to disk.
        - *dbdir* <code>string</code> - the directory to store the cabal data
        - *preferredPort* <code>string</code> - the port cabal will listen on for traffic
    - *maxFeeds* <code>number</code> <code> = 1000</code> - max amount of feeds to sync
    - *persistentCache* <code>object</code> - specify a `read` and `write` to create a persistent DNS cache
        - read <code>function</code> - async cache lookup function
        - write <code>function</code> - async cache write function


* * *

<a name="Client+resolveName"></a>

### client.resolveName(name, [cb])
Resolve the DNS shortname `name`. If `name` is already a cabal key,  it will
be returned and the DNS lookup is aborted.
If `name` is a whisper:// key, a DHT lookup for the passed-in key will occur. 
Once a match is found, it is assumed to be a cabal key, which is returned.
Returns the cabal key in `cb`. If `cb` is null a Promise is returned.

**Params**

- name <code>string</code> - the DNS shortname, or whisper:// shortname
- *cb* <code>function</code> - The callback to be called when lookup succeeds


* * *

<a name="Client+createCabal"></a>

### client.createCabal() ⇒ <code>Promise</code>
Create a new cabal.

**Returns**: <code>Promise</code> - a promise that resolves into a `CabalDetails` instance.  

* * *

<a name="Client+addCabal"></a>

### client.addCabal(key, opts, cb) ⇒ <code>Promise</code>
Add/load the cabal at `key`.

**Returns**: <code>Promise</code> - a promise that resolves into a `CabalDetails` instance.  
**Params**

- key <code>string</code>
- opts <code>object</code>
- cb <code>function</code> - a function to be called when the cabal has been initialized.


* * *

<a name="Client+focusCabal"></a>

### client.focusCabal(key)
Focus the cabal at `key`, used when you want to switch from one open cabal to another.

**Params**

- key <code>string</code>


* * *

<a name="Client+removeCabal"></a>

### client.removeCabal(key, cb)
Remove the cabal `key`. Destroys everything related to it
(the data is however still persisted to disk, fret not!).

**Params**

- key <code>string</code>
- cb <code>function</code>


* * *

<a name="Client+getDetails"></a>

### client.getDetails() ⇒ [<code>CabalDetails</code>](#CabalDetails)
Returns the details of a cabal for the given key.


* * *

<a name="Client+getCabalKeys"></a>

### client.getCabalKeys() ⇒ <code>Array.&lt;string&gt;</code>
Returns a list of cabal keys, one for each open cabal.


* * *

<a name="Client+getCurrentCabal"></a>

### client.getCurrentCabal() ⇒ [<code>CabalDetails</code>](#CabalDetails)
Get the current cabal.


* * *

<a name="Client+addCommand"></a>

### client.addCommand([name], [cmd])
Add a command to the set of supported commands.

**Params**

- *name* <code>string</code> - the long-form command name
- *cmd* <code>object</code> - the command object
    - *help* <code>function</code> - function returning help text
    - *alias* <code>array</code> - array of string aliases
    - *call* <code>function</code> - implementation of the command receiving (cabal, res, arg) arguments


* * *

<a name="Client+removeCommand"></a>

### client.removeCommand([name])
Remove a command.

**Params**

- *name* <code>string</code> - the command name


* * *

<a name="Client+getCommands"></a>

### client.getCommands()
Get an object mapping command names to command objects.


* * *

<a name="Client+addAlias"></a>

### client.addAlias([longCmd], [shortCmd])
Add an alias `shortCmd` for `longCmd`

**Params**

- *longCmd* <code>string</code> - command to be aliased
- *shortCmd* <code>string</code> - alias


* * *

<a name="Client+cabalToDetails"></a>

### client.cabalToDetails([cabal]) ⇒ [<code>CabalDetails</code>](#CabalDetails)
Returns a `CabalDetails` instance for the passed in `cabal-core` instance.

**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+addStatusMessage"></a>

### client.addStatusMessage(message, channel, [cabal])
Add a status message, displayed client-side only, to the specified channel and cabal.
If no cabal is specified, the currently focused cabal is used.

**Params**

- message <code>object</code>
- channel <code>string</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+clearStatusMessages"></a>

### client.clearStatusMessages(channel, [cabal])
Clear status messages for the specified channel.

**Params**

- channel <code>string</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getUsers"></a>

### client.getUsers([cabal]) ⇒ <code>Array.&lt;Object&gt;</code>
Returns a list of all the users for the specified cabal.
If no cabal is specified, the currently focused cabal is used.

**Returns**: <code>Array.&lt;Object&gt;</code> - the list of users  
**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getJoinedChannels"></a>

### client.getJoinedChannels([cabal]) ⇒ <code>Array.&lt;Object&gt;</code>
Returns a list of channels the user has joined for the specified cabal.
If no cabal is specified, the currently focused cabal is used.

**Returns**: <code>Array.&lt;Object&gt;</code> - the list of Channels  
**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getChannels"></a>

### client.getChannels([cabal]) ⇒ <code>Array.&lt;Object&gt;</code>
Returns a list of all channels for the specified cabal.
If no cabal is specified, the currently focused cabal is used.

**Returns**: <code>Array.&lt;Object&gt;</code> - the list of Channels  
**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+subscribe"></a>

### client.subscribe(listener, [cabal])
Add a new listener for the `update` event.

**Params**

- listener <code>function</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+unsubscribe"></a>

### client.unsubscribe(listener, [cabal])
Remove a previously added listener.

**Params**

- listener <code>function</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getMessages"></a>

### client.getMessages([opts], [cb], [cabal])
Returns a list of messages according to `opts`. If `cb` is null, a Promise is returned.

**Params**

- *opts* <code>Object</code>
    - *olderThan* <code>number</code> - timestamp in epoch time. we want to get messages that are *older* than this ts
    - *newerThan* <code>number</code> - timestamp in epoch time. we want to get messages that are *newer* than this ts
    - *amount* <code>number</code> - amount of messages to get
    - *channel* <code>string</code> - channel to get messages from. defaults to currently focused channel
- *cb* <code>function</code> - the callback to be called when messages are retreived
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+searchMessages"></a>

### client.searchMessages([searchString], [opts], [cabal]) ⇒ <code>Promise</code>
Searches for messages that include the search string according to `opts`.
Each returned match contains a message string and a matchedIndexes array containing the indexes at which the search string was found in the message

**Returns**: <code>Promise</code> - a promise that resolves into a list of matches.  
**Params**

- *searchString* <code>string</code> - string to match messages against
- *opts* <code>Object</code>
    - *olderThan* <code>number</code> - timestamp in epoch time. we want to search through messages that are *older* than this ts
    - *newerThan* <code>number</code> - timestamp in epoch time. we want to search through messages that are *newer* than this ts
    - *amount* <code>number</code> - amount of messages to be search through
    - *channel* <code>string</code> - channel to get messages from. defaults to currently focused channel
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getNumberUnreadMessages"></a>

### client.getNumberUnreadMessages(channel, [cabal]) ⇒ <code>number</code>
Returns the number of unread messages for `channel`.

**Params**

- channel <code>string</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getNumberMentions"></a>

### client.getNumberMentions([channel], [cabal])
Returns the number of mentions in `channel`.

**Params**

- *channel* <code>string</code> <code> = &quot;this.getCurrentChannel()&quot;</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getMentions"></a>

### client.getMentions([channel], [cabal])
Returns a list of messages that triggered a mention in channel.

**Params**

- *channel* <code>string</code> <code> = &quot;this.getCurrentChannel()&quot;</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+focusChannel"></a>

### client.focusChannel([channel], [keepUnread], [cabal])
View `channel`, closing the previously focused channel.

**Params**

- *channel* <code>\*</code> <code> = this.getCurrentChannel()</code>
- *keepUnread* <code>boolean</code> <code> = false</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+unfocusChannel"></a>

### client.unfocusChannel([channel], [newChannel], [cabal])
Close `channel`.

**Params**

- *channel* <code>string</code> <code> = &quot;this.getCurrentChannel()&quot;</code>
- *newChannel* <code>string</code> <code> = null</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getCurrentChannel"></a>

### client.getCurrentChannel() ⇒ <code>string</code>
Returns the currently focused channel name.


* * *

<a name="Client+markChannelRead"></a>

### client.markChannelRead(channel, [cabal])
Mark the channel as read.

**Params**

- channel <code>string</code>
- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client.getDatabaseVersion"></a>

### Client.getDatabaseVersion() ⇒ <code>string</code>
Get the current database version.


* * *

<a name="Client.generateKey"></a>

### Client.generateKey() ⇒ <code>string</code>
Returns a 64 character hex string i.e. a newly generated cabal key.
Useful if you want to programmatically create a new cabal as part of a shell pipeline.


* * *

<a name="Client.scrubKey"></a>

### Client.scrubKey(key) ⇒ <code>string</code>
Removes URI scheme, URI search params (if present), and returns the cabal key as a 64 character hex string

**Returns**: <code>string</code> - the scrubbed key  
**Params**

- key <code>string</code> - the key to scrub

**Example**  
```js
Client.scrubKey('cabal://12345678...?admin=7331b4b..')
// => '12345678...'
```

* * *

<a name="Client.getCabalDirectory"></a>

### Client.getCabalDirectory() ⇒ <code>string</code>
Returns a string path of where all of the cabals are stored on the hard drive.

**Returns**: <code>string</code> - the cabal directory  

* * *

<a name="CabalDetails"></a>

## CabalDetails
**Emits**: [<code>update</code>](#CabalDetails+event_update), [<code>init</code>](#CabalDetails+event_init), [<code>info</code>](#CabalDetails+event_info), [<code>user-updated</code>](#CabalDetails+event_user-updated), [<code>new-channel</code>](#CabalDetails+event_new-channel), [<code>new-message</code>](#CabalDetails+event_new-message), [<code>private-message</code>](#CabalDetails+event_private-message), [<code>publish-message</code>](#CabalDetails+event_publish-message), <code>CabalDetails#event:publish-private-message</code>, [<code>publish-nick</code>](#CabalDetails+event_publish-nick), [<code>status-message</code>](#CabalDetails+event_status-message), [<code>topic</code>](#CabalDetails+event_topic), [<code>channel-focus</code>](#CabalDetails+event_channel-focus), [<code>channel-join</code>](#CabalDetails+event_channel-join), [<code>channel-leave</code>](#CabalDetails+event_channel-leave), [<code>cabal-focus</code>](#CabalDetails+event_cabal-focus), [<code>started-peering</code>](#CabalDetails+event_started-peering), [<code>stopped-peering</code>](#CabalDetails+event_stopped-peering)  

* [CabalDetails](#CabalDetails)
    * [new CabalDetails({, done)](#new_CabalDetails_new)
    * [.processLine([line], [cb])](#CabalDetails+processLine)
    * [.publishMessage(msg, [opts], [cb])](#CabalDetails+publishMessage)
    * [.publishNick(nick, [cb])](#CabalDetails+publishNick)
    * [.publishChannelTopic([channel], topic, cb)](#CabalDetails+publishChannelTopic)
    * [.getTopic([channel])](#CabalDetails+getTopic) ⇒ <code>string</code>
    * [.getChannelMembers([channel])](#CabalDetails+getChannelMembers) ⇒ <code>Array.&lt;object&gt;</code>
    * [.addStatusMessage(message, [channel])](#CabalDetails+addStatusMessage)
    * [.getChannels([opts])](#CabalDetails+getChannels)
    * [.getCurrentChannel()](#CabalDetails+getCurrentChannel) ⇒ <code>string</code>
    * [.getCurrentChannelDetails()](#CabalDetails+getCurrentChannelDetails) ⇒ <code>ChannelDetails</code>
    * [.clearVirtualMessages([channel])](#CabalDetails+clearVirtualMessages)
    * [.getPrivateMessageList()](#CabalDetails+getPrivateMessageList)
    * [.isChannelPrivate()](#CabalDetails+isChannelPrivate)
    * [.publishPrivateMessage(msg, recipientKey, [cb])](#CabalDetails+publishPrivateMessage)
    * [.getJoinedChannels()](#CabalDetails+getJoinedChannels) ⇒ <code>Array.&lt;string&gt;</code>
    * [.getLocalUser()](#CabalDetails+getLocalUser) ⇒ <code>user</code>
    * [.getLocalName()](#CabalDetails+getLocalName) ⇒ <code>string</code>
    * [.joinChannel(channel)](#CabalDetails+joinChannel)
    * [.leaveChannel(channel)](#CabalDetails+leaveChannel)
    * [.archiveChannel(channel, [reason], cb(err))](#CabalDetails+archiveChannel)
    * [.unarchiveChannel(channel, [reason], cb(err))](#CabalDetails+unarchiveChannel)
    * [.getUsers()](#CabalDetails+getUsers) ⇒ <code>object</code>
    * [._destroy()](#CabalDetails+_destroy)
    * ["update"](#CabalDetails+event_update)
    * ["init"](#CabalDetails+event_init)
    * ["user-updated"](#CabalDetails+event_user-updated)
    * ["new-channel"](#CabalDetails+event_new-channel)
    * ["new-message"](#CabalDetails+event_new-message)
    * ["private-message"](#CabalDetails+event_private-message)
    * ["publish-message"](#CabalDetails+event_publish-message)
    * ["publish-message"](#CabalDetails+event_publish-message)
    * ["publish-nick"](#CabalDetails+event_publish-nick)
    * ["status-message"](#CabalDetails+event_status-message)
    * ["topic"](#CabalDetails+event_topic)
    * ["channel-focus"](#CabalDetails+event_channel-focus)
    * ["channel-join"](#CabalDetails+event_channel-join)
    * ["channel-leave"](#CabalDetails+event_channel-leave)
    * ["cabal-focus"](#CabalDetails+event_cabal-focus)
    * ["started-peering"](#CabalDetails+event_started-peering)
    * ["stopped-peering"](#CabalDetails+event_stopped-peering)
    * ["update"](#CabalDetails+event_update)
    * ["info"](#CabalDetails+event_info)


* * *

<a name="new_CabalDetails_new"></a>

### new CabalDetails({, done)
**Params**

- { <code>object</code> - cabal , commands, aliases }
- done <code>function</code> - the function to be called after the cabal is initialized


* * *

<a name="CabalDetails+processLine"></a>

### cabalDetails.processLine([line], [cb])
Interpret a line of input from the user.
This may involve running a command or publishing a message to the current
channel.

**Params**

- *line* <code>string</code> - input from the user
- *cb* <code>function</code> - callback called when the input is processed


* * *

<a name="CabalDetails+publishMessage"></a>

### cabalDetails.publishMessage(msg, [opts], [cb])
Publish a message up to consumer. See
[`cabal-core`](https://github.com/cabal-club/cabal-core/)
for the full list of options.

**Params**

- msg <code>object</code> - the full message object
- *opts* <code>object</code> - options passed down to cabal.publish
- *cb* <code>function</code> - callback function called when message is published

**Example**  
```js
cabalDetails.publishMessage({
  type: 'chat/text',
  content: {
    text: 'hello world',
    channel: 'cabal-dev'
  }
})
```

* * *

<a name="CabalDetails+publishNick"></a>

### cabalDetails.publishNick(nick, [cb])
Announce a new nickname.

**Params**

- nick <code>string</code>
- *cb* <code>function</code> - will be called after the nick is published


* * *

<a name="CabalDetails+publishChannelTopic"></a>

### cabalDetails.publishChannelTopic([channel], topic, cb)
Publish a new channel topic to `channel`.

**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>
- topic <code>string</code>
- cb <code>function</code> - will be called when publishing has finished.


* * *

<a name="CabalDetails+getTopic"></a>

### cabalDetails.getTopic([channel]) ⇒ <code>string</code>
**Returns**: <code>string</code> - The current topic of `channel` as a string  
**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+getChannelMembers"></a>

### cabalDetails.getChannelMembers([channel]) ⇒ <code>Array.&lt;object&gt;</code>
Return the list of users that have joined `channel`.
Note: this can be a subset of all of the users in a cabal.

**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+addStatusMessage"></a>

### cabalDetails.addStatusMessage(message, [channel])
Add a status message, visible locally only.

**Params**

- message <code>object</code>
- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+getChannels"></a>

### cabalDetails.getChannels([opts])
**Params**

- *opts* <code>object</code>

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| includeArchived | <code>boolean</code> | Determines whether to include archived channels or not. Defaults to false. |
| includePM | <code>boolean</code> | Determines whether to include private message channels or not. Defaults to false. * @returns {string[]} a list of all the channels in this cabal. Does not return channels with 0 members. |


* * *

<a name="CabalDetails+getCurrentChannel"></a>

### cabalDetails.getCurrentChannel() ⇒ <code>string</code>
**Returns**: <code>string</code> - The name of the current channel  

* * *

<a name="CabalDetails+getCurrentChannelDetails"></a>

### cabalDetails.getCurrentChannelDetails() ⇒ <code>ChannelDetails</code>
**Returns**: <code>ChannelDetails</code> - A ChannelDetails object for the current chanel  

* * *

<a name="CabalDetails+clearVirtualMessages"></a>

### cabalDetails.clearVirtualMessages([channel])
Remove all of the virtual (i.e. status) messages associated with this channel.
Virtual messages are local only.

**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+getPrivateMessageList"></a>

### cabalDetails.getPrivateMessageList()
Get the list of currently opened private message channels.

**Returns{string[]}**: A list of all public keys you have an open PM with (hidden users are removed from list).  

* * *

<a name="CabalDetails+isChannelPrivate"></a>

### cabalDetails.isChannelPrivate()
Query if the passed in channel name is private or not

**Returns{boolean}**: true if channel is private, false if not (or if it doesn't exist)  

* * *

<a name="CabalDetails+publishPrivateMessage"></a>

### cabalDetails.publishPrivateMessage(msg, recipientKey, [cb])
Send a private message to a recipient. Open and focus a new private message channel if one doesn't exist already.

**Params**

- msg <code>string</code> - a message object conforming to any type of chat message  (e.g. `chat/text` or `chat/emote`),
see CabalDetails.publishMessage for more information
- recipientKey <code>string</code> - the public key of the recipient
- *cb* <code>function</code> - optional callback triggered after trying to publish (returns err if failed)


* * *

<a name="CabalDetails+getJoinedChannels"></a>

### cabalDetails.getJoinedChannels() ⇒ <code>Array.&lt;string&gt;</code>
**Returns**: <code>Array.&lt;string&gt;</code> - A list of all of the channel names the user has joined. Excludes private message channels.  

* * *

<a name="CabalDetails+getLocalUser"></a>

### cabalDetails.getLocalUser() ⇒ <code>user</code>
**Returns**: <code>user</code> - The local user for this cabal.  

* * *

<a name="CabalDetails+getLocalName"></a>

### cabalDetails.getLocalName() ⇒ <code>string</code>
**Returns**: <code>string</code> - The local user's username (or their truncated public key, if their
username is not set)  

* * *

<a name="CabalDetails+joinChannel"></a>

### cabalDetails.joinChannel(channel)
Join a channel. This is distinct from focusing a channel, as this actually tracks changes
and publishes a message announcing that you have joined the channel

**Params**

- channel <code>string</code>


* * *

<a name="CabalDetails+leaveChannel"></a>

### cabalDetails.leaveChannel(channel)
Leave a joined channel. This publishes a message announcing
that you have left the channel.

**Params**

- channel <code>string</code>


* * *

<a name="CabalDetails+archiveChannel"></a>

### cabalDetails.archiveChannel(channel, [reason], cb(err))
Archive a channel. Publishes a message announcing
that you have archived the channel, applying it to the views of others who have you as a moderator/admin.

**Params**

- channel <code>string</code>
- *reason* <code>string</code>
- cb(err) <code>function</code> - callback invoked when the operation has finished, with error as its only parameter


* * *

<a name="CabalDetails+unarchiveChannel"></a>

### cabalDetails.unarchiveChannel(channel, [reason], cb(err))
Unarchive a channel. Publishes a message announcing
that you have unarchived the channel.

**Params**

- channel <code>string</code>
- *reason* <code>string</code>
- cb(err) <code>function</code> - callback invoked when the operation has finished, with error as its only parameter


* * *

<a name="CabalDetails+getUsers"></a>

### cabalDetails.getUsers() ⇒ <code>object</code>
**Returns**: <code>object</code> - all of the users in this cabal. Each key is the public key of its
corresponding user.  

* * *

<a name="CabalDetails+_destroy"></a>

### cabalDetails.\_destroy()
Destroy all of the listeners associated with this `details` instance


* * *

<a name="CabalDetails+event_update"></a>

### "update"
**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| local | <code>boolean</code> |  |
| online | <code>boolean</code> |  |
| name | <code>string</code> | The user's username |
| key | <code>string</code> | The user's public key |
| flags | <code>Map.&lt;string, string&gt;</code> | The user's array of flags per channel   ("@" means cabal-wide"). Possible flags include   {"admin", "mod", "normal", "hide", "mute", "block"}. |


* * *

<a name="CabalDetails+event_init"></a>

### "init"
Fires when the cabal has finished initialization

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  

* * *

<a name="CabalDetails+event_user-updated"></a>

### "user-updated"
Fires when a user has updated their nickname

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Public key of the updated user |
| user | <code>object</code> | Object containing user information |
| user.name | <code>string</code> | Current nickname of the updated user |


* * *

<a name="CabalDetails+event_new-channel"></a>

### "new-channel"
Fires when a new channel has been created

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the created channel |


* * *

<a name="CabalDetails+event_new-message"></a>

### "new-message"
Fires when a new message has been posted

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the channel the message was posted to |
| author | <code>object</code> | Object containing the user that posted the message |
| author.name | <code>string</code> | Nickname of the user |
| author.key | <code>string</code> | Public key of the user |
| author.local | <code>boolean</code> | True if user is the local user (i.e. at the keyboard and not someone else in the cabal) |
| author.online | <code>boolean</code> | True if the user is currently online |
| message | <code>object</code> | The message that was posted. See `cabal-core` for more complete message documentation. |
| message.key | <code>string</code> | Public key of the user posting the message (again, it's a quirk) |
| message.seq | <code>number</code> | Sequence number of the message in the user's append-only log |
| message.value | <code>object</code> | Message content, see `cabal-core` documentation for more information. |


* * *

<a name="CabalDetails+event_private-message"></a>

### "private-message"
Fires when a new private message has been posted

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | The public key corresponding to the private message channel |
| author | <code>object</code> | Object containing the user that posted the message |
| author.name | <code>string</code> | Nickname of the user |
| author.key | <code>string</code> | Public key of the user |
| author.local | <code>boolean</code> | True if user is the local user (i.e. at the keyboard and not someone else in the cabal) |
| author.online | <code>boolean</code> | True if the user is currently online |
| message | <code>object</code> | The message that was posted. See `cabal-core` for more complete message documentation. |
| message.key | <code>string</code> | Public key of the user posting the message (again, it's a quirk) |
| message.seq | <code>number</code> | Sequence number of the message in the user's append-only log |
| message.value | <code>object</code> | Message content, see `cabal-core` documentation for more information. |


* * *

<a name="CabalDetails+event_publish-message"></a>

### "publish-message"
Fires when the local user has published a new message

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| message | <code>object</code> | The message that was posted. See `cabal-core` for more complete message documentation. |
| message.type | <code>string</code> | Message type that was posted, e.g. `chat/text` or `chat/emote` |
| message.content | <code>string</code> | Message contents, e.g. channel and text if `chat/text` |
| message.timestamp | <code>number</code> | The time the message was published |


* * *

<a name="CabalDetails+event_publish-message"></a>

### "publish-message"
Fires when the local user has published a new private message

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| message | <code>object</code> | The message that was posted. See `cabal-core` for more complete message documentation. |
| message.type | <code>string</code> | Message type that was posted, e.g. `chat/text` or `chat/emote` |
| message.content | <code>string</code> | Message contents, e.g. channel and text if `chat/text` |
| message.timestamp | <code>number</code> | The time the message was published |


* * *

<a name="CabalDetails+event_publish-nick"></a>

### "publish-nick"
Fires when the local user has published a new nickname

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | The nickname that was published |


* * *

<a name="CabalDetails+event_status-message"></a>

### "status-message"
Fires when a status message has been created. These are only visible by the local user.

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the channel the message was published to |
| message | <code>object</code> |  |
| message.timestamp | <code>number</code> | Publish timestamp |
| message.text | <code>string</code> | The published status message contents |


* * *

<a name="CabalDetails+event_topic"></a>

### "topic"
Fires when a new channel topic has been set

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the channel with the new topic |
| topic | <code>string</code> | Name of the channel with the new topic |


* * *

<a name="CabalDetails+event_channel-focus"></a>

### "channel-focus"
Fires when the user has focused (i.e. switched to) a new channel

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the focused channel |


* * *

<a name="CabalDetails+event_channel-join"></a>

### "channel-join"
Fires when a user has joined a channel

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the joined channel |
| key | <code>string</code> | Public key of the user joining the channel |
| isLocal | <code>boolean</code> | True if it was the local user joining a new channel |


* * *

<a name="CabalDetails+event_channel-leave"></a>

### "channel-leave"
Fires when a user has leaveed a channel

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| channel | <code>string</code> | Name of the leaved channel |
| key | <code>string</code> | Public key of the user leaving the channel |
| isLocal | <code>boolean</code> | True if it was the local user leaving a new channel |


* * *

<a name="CabalDetails+event_cabal-focus"></a>

### "cabal-focus"
Fires when another cabal has been focused

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Key of the focused cabal |


* * *

<a name="CabalDetails+event_started-peering"></a>

### "started-peering"
Fires when the local user has connected directly with another peer

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Public key of the other peer |
| name- | <code>string</code> | Name of the other peer |


* * *

<a name="CabalDetails+event_stopped-peering"></a>

### "stopped-peering"
Fires when the local user has disconnected with another peer

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | Public key of the other peer |
| name- | <code>string</code> | Name of the other peer |


* * *

<a name="CabalDetails+event_update"></a>

### "update"
Fires when any kind of change has happened to the cabal.

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  

* * *

<a name="CabalDetails+event_info"></a>

### "info"
Fires when a valid slash-command (/<command>) emits output. See src/commands.js for all commands & their payloads.

**Kind**: event emitted by [<code>CabalDetails</code>](#CabalDetails)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| command | <code>string</code> | The command that triggered the event & has emitted output |


* * *

