Promise = require 'bluebird'
portscanner = require 'portscanner'

Promise.promisifyAll portscanner

module.exports = Promise.coroutine (host, port) ->
    try
        status = yield portscanner.checkPortStatusAsync port, host
    catch err
        return false

    return status is 'open'
