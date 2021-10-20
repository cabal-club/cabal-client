// returns the passed-in string to be compatible with how random-access-* modules work (pass function or string)
// instead of just passing e.g. an instance of "random-access-file", we want to preserve the path cabal uses to store
// data / hypercores
module.exports = function (filename) {
  return filename
}
