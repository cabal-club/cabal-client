const test = require('tape')
const Client = require('..')

test('create a cabal', function (t) {
  t.plan(2)

  const client = new Client({
    config: {
      temp: true
    }
  })

  client.createCabal({noSwarm:true})
    .then((cabal) => {
      t.pass('cabal created ok')
      cabal.core.close(() => t.pass('cabal closed ok'))
    })
    .catch(err => {
      t.error(err)
    })
})

