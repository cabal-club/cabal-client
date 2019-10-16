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
        * [.addCabal(key, cb)](#Client+addCabal) ⇒ <code>Promise</code>
        * [.focusCabal(key)](#Client+focusCabal)
        * [.removeCabal(key)](#Client+removeCabal)
        * [.getCabalKeys()](#Client+getCabalKeys) ⇒ <code>Array.&lt;string&gt;</code>
        * [.getCurrentCabal()](#Client+getCurrentCabal) ⇒ [<code>CabalDetails</code>](#CabalDetails)
        * [.cabalToDetails([cabal])](#Client+cabalToDetails) ⇒ [<code>CabalDetails</code>](#CabalDetails)
        * [.addStatusMessage(message, channel, [cabal])](#Client+addStatusMessage)
        * [.clearStatusMessages(channel, [cabal])](#Client+clearStatusMessages)
        * [.getUsers([cabal])](#Client+getUsers) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getJoinedChannels([cabal])](#Client+getJoinedChannels) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.getChannels([cabal])](#Client+getChannels) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.subscribe(listener, [cabal])](#Client+subscribe)
        * [.unsubscribe(listener, [cabal])](#Client+unsubscribe)
        * [.getMessages([opts], [cb], [cabal])](#Client+getMessages)
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
Create a client instance from which to manage multiple [`cabal-core`](https://github.com/cabal-club/cabal-core/) instances.

**Params**

- *opts* <code>object</code>
    - config <code>object</code>
        - temp <code>boolean</code> - if `temp` is true no data is persisted to disk.
        - *dbdir* <code>string</code> - the directory to store the cabal data
    - *maxFeeds* <code>number</code> <code> = 1000</code> - max amount of feeds to sync
    - *persistentCache* <code>object</code> - specify a `read` and `write` to create a persistent DNS cache
        - read <code>function</code> - async cache lookup function
        - write <code>function</code> - async cache write function


* * *

<a name="Client+resolveName"></a>

### client.resolveName(name, [cb])
Resolve the DNS shortname `name`. If `name` is already a cabal key,  it will be returned and the DNS lookup is aborted.Returns the cabal key in `cb`. If `cb` is null a Promise is returned.

**Params**

- name <code>string</code> - the DNS shortname
- *cb* <code>function</code> - The callback to be called when DNS lookup succeeds


* * *

<a name="Client+createCabal"></a>

### client.createCabal() ⇒ <code>Promise</code>
Create a new cabal.

**Returns**: <code>Promise</code> - a promise that resolves into a `CabalDetails` instance.  

* * *

<a name="Client+addCabal"></a>

### client.addCabal(key, cb) ⇒ <code>Promise</code>
Add/load the cabal at `key`.

**Returns**: <code>Promise</code> - a promise that resolves into a `CabalDetails` instance.  
**Params**

- key <code>string</code>
- cb <code>function</code> - a function to be called when the cabal has been initialized.


* * *

<a name="Client+focusCabal"></a>

### client.focusCabal(key)
Focus the cabal at `key`, used when you want to switch from one open cabal to another.

**Params**

- key <code>string</code>


* * *

<a name="Client+removeCabal"></a>

### client.removeCabal(key)
Remove the cabal `key`. Destroys everything related to it (the data is however still persisted to disk, fret not!).

**Params**

- key <code>string</code>


* * *

<a name="Client+getCabalKeys"></a>

### client.getCabalKeys() ⇒ <code>Array.&lt;string&gt;</code>
Returns a list of cabal keys, one for each open cabal.


* * *

<a name="Client+getCurrentCabal"></a>

### client.getCurrentCabal() ⇒ [<code>CabalDetails</code>](#CabalDetails)
Get the current cabal.


* * *

<a name="Client+cabalToDetails"></a>

### client.cabalToDetails([cabal]) ⇒ [<code>CabalDetails</code>](#CabalDetails)
Returns a `CabalDetails` instance for the passed in `cabal-core` instance.

**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+addStatusMessage"></a>

### client.addStatusMessage(message, channel, [cabal])
Add a status message, displayed client-side only, to the specified channel and cabal. If no cabal is specified, the currently focused cabal is used.

**Params**

- message <code>string</code>
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
Returns a list of all the users for the specified cabal. If no cabal is specified, the currently focused cabal is used.

**Returns**: <code>Array.&lt;Object&gt;</code> - the list of users  
**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getJoinedChannels"></a>

### client.getJoinedChannels([cabal]) ⇒ <code>Array.&lt;Object&gt;</code>
Returns a list of channels the user has joined for the specified cabal. If no cabal is specified, the currently focused cabal is used.

**Returns**: <code>Array.&lt;Object&gt;</code> - the list of Channels  
**Params**

- *cabal* <code>Cabal</code> <code> = this.currentCabal</code>


* * *

<a name="Client+getChannels"></a>

### client.getChannels([cabal]) ⇒ <code>Array.&lt;Object&gt;</code>
Returns a list of all channels for the specified cabal. If no cabal is specified, the currently focused cabal is used.

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
Returns a 64 character hex string i.e. a newly generated cabal key. Useful if you want to programmatically create a new cabal as part of a shell pipeline.


* * *

<a name="Client.scrubKey"></a>

### Client.scrubKey(key) ⇒ <code>string</code>
Removes URI scheme and returns the cabal key as a 64 character hex string

**Returns**: <code>string</code> - the scrubbed key  
**Params**

- key <code>string</code> - the key to scrub

**Example**  
```js
Client.scrubKey('cabal://12345678...')// => '12345678...'
```

* * *

<a name="Client.getCabalDirectory"></a>

### Client.getCabalDirectory() ⇒ <code>string</code>
Returns a string path of where all of the cabals are stored on the hard drive.

**Returns**: <code>string</code> - the cabal directory  

* * *

<a name="CabalDetails"></a>

## CabalDetails
**Emits**: [<code>update</code>](#CabalDetails+event_update)  

* [CabalDetails](#CabalDetails)
    * [new CabalDetails(cabal, done)](#new_CabalDetails_new)
    * [.publishMessage(msg, [opts], [cb])](#CabalDetails+publishMessage)
    * [.publishNick(nick, [cb])](#CabalDetails+publishNick)
    * [.publishChannelTopic([channel], topic, cb)](#CabalDetails+publishChannelTopic)
    * [.getTopic([channel])](#CabalDetails+getTopic) ⇒ <code>string</code>
    * [.getChannelMembers([channel])](#CabalDetails+getChannelMembers) ⇒ <code>Array.&lt;object&gt;</code>
    * [.addStatusMessage(message, [channel])](#CabalDetails+addStatusMessage)
    * [.getChannels()](#CabalDetails+getChannels) ⇒ <code>Array.&lt;string&gt;</code>
    * [.getCurrentChannel()](#CabalDetails+getCurrentChannel) ⇒ <code>string</code>
    * [.getCurrentChannelDetails()](#CabalDetails+getCurrentChannelDetails) ⇒ <code>ChannelDetails</code>
    * [.clearVirtualMessages([channel])](#CabalDetails+clearVirtualMessages)
    * [.getJoinedChannels()](#CabalDetails+getJoinedChannels) ⇒ <code>Array.&lt;string&gt;</code>
    * [.getLocalUser()](#CabalDetails+getLocalUser) ⇒ <code>user</code>
    * [.getLocalName()](#CabalDetails+getLocalName) ⇒ <code>string</code>
    * [.joinChannel(channel)](#CabalDetails+joinChannel)
    * [.leaveChannel(channel)](#CabalDetails+leaveChannel)
    * [.getUsers()](#CabalDetails+getUsers) ⇒ <code>object</code>
    * [._destroy()](#CabalDetails+_destroy)
    * ["update"](#CabalDetails+event_update)


* * *

<a name="new_CabalDetails_new"></a>

### new CabalDetails(cabal, done)
**Params**

- cabal <code>\*</code>
- done <code>function</code> - the function to be called after the cabal is initialized


* * *

<a name="CabalDetails+publishMessage"></a>

### cabalDetails.publishMessage(msg, [opts], [cb])
Publish a message up to consumer. See [`cabal-core`](https://github.com/cabal-club/cabal-core/) for the full list of options.

**Params**

- msg <code>object</code> - the full message object
- *opts* <code>object</code> - options passed down to cabal.publish
- *cb* <code>function</code> - callback function called when message is published

**Example**  
```js
cabalDetails.publishMessage({  type: 'chat/text',  content: {    text: 'hello world',    channel: 'cabal-dev'  }})
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
Return the list of users that have joined `channel`. Note: this can be a subset of all of the users in a cabal.

**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+addStatusMessage"></a>

### cabalDetails.addStatusMessage(message, [channel])
Add a status message, visible locally only.

**Params**

- message <code>string</code>
- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+getChannels"></a>

### cabalDetails.getChannels() ⇒ <code>Array.&lt;string&gt;</code>
**Returns**: <code>Array.&lt;string&gt;</code> - a list of all the channels in this cabal.  

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
Remove all of the virtual (i.e. status) messages associated with this channel. Virtual messages are local only.

**Params**

- *channel* <code>string</code> <code> = &quot;this.chname&quot;</code>


* * *

<a name="CabalDetails+getJoinedChannels"></a>

### cabalDetails.getJoinedChannels() ⇒ <code>Array.&lt;string&gt;</code>
**Returns**: <code>Array.&lt;string&gt;</code> - A list of all of the channel names the user has joined.  

* * *

<a name="CabalDetails+getLocalUser"></a>

### cabalDetails.getLocalUser() ⇒ <code>user</code>
**Returns**: <code>user</code> - The local user for this cabal.  

* * *

<a name="CabalDetails+getLocalName"></a>

### cabalDetails.getLocalName() ⇒ <code>string</code>
**Returns**: <code>string</code> - The local user's username (or their truncated public key, if theirusername is not set)  

* * *

<a name="CabalDetails+joinChannel"></a>

### cabalDetails.joinChannel(channel)
Join a channel. This is distinct from focusing a channel, as this actually tracks changesand publishes a message announcing that you have joined the channel

**Params**

- channel <code>string</code>


* * *

<a name="CabalDetails+leaveChannel"></a>

### cabalDetails.leaveChannel(channel)
Leave a joined channel. This publishes a message announcing that you have left the channel.

**Params**

- channel <code>string</code>


* * *

<a name="CabalDetails+getUsers"></a>

### cabalDetails.getUsers() ⇒ <code>object</code>
**Returns**: <code>object</code> - all of the users in this cabal. Each key is the public key of its corresponding user.  

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


* * *

