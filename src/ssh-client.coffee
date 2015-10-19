Promise = require 'bluebird'
{Client, SFTP_STATUS_CODE} = require 'ssh2'

Promise.promisifyAll Client.prototype

class SSHClient
    constructor: (@config) ->

    connect: ->
        new Promise (resolve, reject) =>
            @connection = new Client()
            @connection
                .on 'ready', =>
                    resolve this
                .on 'error', (err) ->
                    reject err
                .connect @config

    close: ->
        new Promise (resolve, reject) =>
            @connection
                .on 'close', =>
                    resolve this
                .end()

    exec: (command) ->
        new Promise Promise.coroutine (resolve, reject) =>
            try
                stream = yield @connection.execAsync command
                stream.pipe process.stdout
                stream.stderr.pipe process.stderr
                stream
                    .on 'close', (code) ->
                        if code is 0
                            resolve()
                        else
                            error = new Error "command '#{command}' failed with exit code #{code}"
                            error.code = code
                            reject error
                    .on 'error', (err) ->
                        reject err
                    .on 'end', ->
                        resolve()
            catch err
                reject err

    writeToFile: (content, remotePath) ->
        new Promise (resolve, reject) =>
            @connection.sftp (err, sftp) =>
                return reject err if err?

                writeStream = sftp.createWriteStream remotePath
                writeStream.on 'finish', ->
                    resolve()
                writeStream.write content, 'utf-8', (err) ->
                    return reject err if err?
                    writeStream.end()

    fileExists: (remotePath) ->
        new Promise (resolve, reject) =>
            @connection.sftp (err, sftp) =>
                return reject err if err?

                sftp.stat remotePath, (err, stats) ->
                    if err?
                        if err.code is SFTP_STATUS_CODE.NO_SUCH_FILE
                            return resolve false
                        return reject err

                    resolve true

class ProxiedSSHClient extends SSHClient
    constructor: (@proxyConfig, config) ->
        @_host = config.host
        @_port = config.port ? 22

        config.host = undefined
        config.port = undefined
        super config

    connect: Promise.coroutine ->
        throw new Error 'no host to proxy to given' unless @_host?
        throw new Error 'no port to proxy to given' unless @_port?

        @_proxyClient = new SSHClient @proxyConfig
        yield @_proxyClient.connect()

        proxyStream = yield @_proxyClient.connection.execAsync "nc #{@_host} #{@_port}"
        @config.sock = proxyStream
        yield SSHClient::connect.call this

    close: Promise.coroutine ->
        yield SSHClient::close.call this
        yield @_proxyClient.close()

module.exports = {
    SSHClient
    ProxiedSSHClient
}
