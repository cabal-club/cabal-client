var Client = require('../src/client') // normally require('cabal-client')

const client = new Client()

// the client is the interface for initializing cabals while
// cabalDetails contains all information and methods for one specific cabal
client.createCabal().then((cabalDetails) => {
  // each cabal is an event emitter
  cabalDetails.on('init', () => {
    console.log('Yay, I\'m ready!')
    // the key is the unique identifier of this cabal
    console.log('My key: ' + cabalDetails.key)
  })
})
