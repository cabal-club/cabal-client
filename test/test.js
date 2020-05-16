const test = require('tape')
const Client = require('..')
const path = require('path')
const tmp = require('tmp')
const rimraf = require('rimraf')

test('create a cabal', function (t) {
  t.plan(4)

  const dir = tmp.dirSync().name
  const client = new Client({
    config: {
      dbdir: dir
    }
  })
  const opts = { noSwarm: true }

  client.createCabal(opts)
    .then((cabal) => {
      t.pass('cabal created ok')
      t.same(cabal.getLocalUser().online, true)
      t.same(cabal.getLocalUser().local, true)
      client.removeCabal(cabal.key, () => {
        t.pass('removed cabal ok')
        rimraf.sync(dir)
      })
    })
    .catch(err => {
      t.error(err)
    })
})

test('check that local user is admin', function (t) {
  t.plan(6)

  let key
  const dir = tmp.dirSync().name
  const client = new Client({
    config: {
      dbdir: dir
    }
  })
  const opts = { noSwarm: true }

  client.createCabal(opts)
    .then((cabal) => {
      t.pass('cabal created ok')
      key = cabal.key

      cabal.joinChannel('default')
      const msg = {
        type: 'chat/text',
        content: {
          text: 'hello'
        }
      }

      cabal.publishMessage(msg, err => {
        t.error(err, 'published msg ok')
        client.removeCabal(key, () => {
          t.pass('removed cabal ok')
          client.addCabal(key, opts)
            .then(cabal => {
              t.pass('re-added cabal ok')
              t.same(cabal.getLocalUser().isAdmin(), true, 'local user is admin')
              client.removeCabal(key, () => {
                t.pass()
                rimraf.sync(dir)
              })
            })
            .catch(err => {
              t.error(err)
            })
        })
      })
    })
    .catch(err => {
      t.error(err)
    })
})

