var Client = require('../src/client') // normally require('cabal-client')

// we have two clients in this example, one for sending and one for recieving
const client = new Client()
const client2 = new Client()

client.createCabal().then((cabalDetails) => {
  cabalDetails.on('new-message', ({ channel, author, message }) => {
    console.log('Recieved: "' + message.value.content.text + '" in channel ' + channel)
  })

  cabalDetails.on('init', () => {
    client2.addCabal(cabalDetails.key).then((cabalDetails2) => {
      // both clients are now connected to the cabal
      cabalDetails2.on('init', () => {
        // this tells the other clients how we want to be called
        cabalDetails2.publishNick('CabalUser10', () => {
          // every new cabal has a channel named default
          cabalDetails2.publishMessage({
            type: 'chat/text',
            content: {
              text: 'Hey there!',
              channel: 'default'
            }
          })

          // other channels will be created when we start using them
          cabalDetails2.publishMessage({
            type: 'chat/text',
            content: {
              text: 'People call me ' + cabalDetails2.getLocalName(),
              channel: 'introduction'
            }
          })
        })
      })
    })
  })
})
