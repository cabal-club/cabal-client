const RAW = require("random-access-web")

// Rationale:
//
// returns a configured random-access-web function, which is lastly consumed by ´multifeed` as the passed-in storage
// function. this allows us to easily support browsers using a browserified version of cabal-client, without forcing
// those clients to implement their own storage function. that is, it brings down the barrier to getting started a bit
//
// (this does not use polyraf by dominic because 
// 1. when polyraf is run, it doesn't return the storage function (it returns a random-access-file/web instance—this is
// not compatible with what e.g. multifeed expects)
// 2. polyraf lacks a maintainer (but mainly it is because of 1.)
//
// also wanted to avoid putting polyraf as a dependency inside multifeed, when we could just implement it this way
module.exports = function (filename) {
  return RAW(filename)
}
