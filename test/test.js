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
      new Promise((res, rej) => {
          client.removeCabal(cabal.key, () => {
            rimraf.sync(dir)
            res()
          })
      }).then(() => t.pass('removed cabal ok'))
    })
    .catch(err => {
      t.error(err)
    })
})

test('try to join an unknown cabal by name', function (t) {
  t.plan(2)

  const dir = tmp.dirSync().name
  const client = new Client({
    config: {
      dbdir: dir
    }
  })
  const opts = { noSwarm: true }
  const garbageKey = "buzzlebopp"

  client.addCabal(garbageKey, opts, (err, res) => {
    t.ok(err)
  })
    .then((cabal) => {
      t.fail('should have failed')
    })
    .catch(err => {
      t.ok(err)
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
          text: 'hello',
          channel: "default"
        }
      }

      new Promise((res, rej) => {
        cabal.publishMessage(msg, (err) => {
          t.error(err, 'published msg ok')
          res()
        })
      }).then(() => {
        return new Promise((res, rej) => {
          client.removeCabal(key, () => {
            res()
          })
        }).then(() => {
          t.pass('removed cabal ok')
          client.addCabal(key, opts)
            .then(cabal => {
              t.pass('re-added cabal ok')
              t.same(cabal.getLocalUser().isAdmin(), true, 'local user is admin')
              return new Promise((res3, rej) => {
                client.removeCabal(key, () => {
                  rimraf.sync(dir)
                  res3()
                })
              }).then(() => t.pass('cleanup ok'))
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
