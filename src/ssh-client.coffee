fs = require 'fs'
path = require 'path'
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
                stream = yield @connection.execAsync "sleep 0.2; #{command}"
                stream.pipe process.stdout
                stream.stderr.pipe process.stderr
                stream
                    .on 'close', (code) ->
                        resolve code
                    .on 'error', (err) ->
                        reject err
            catch err
                reject err

    execScript: (pathToScript, args = [], opts = {}) ->
        new Promise Promise.coroutine (resolve, reject) =>
            try
                command = "bash -s #{args.join ' '}"

                if opts.sudo is true
                    command = 'sudo ' + command

                stream = yield @connection.execAsync command
                stream
                    .on 'close', (code) ->
                        resolve code
                    .on 'error', (err) ->
                        reject err

                stream.pipe process.stdout
                stream.stderr.pipe process.stderr

                scriptReadStream = fs.createReadStream path.resolve pathToScript
                scriptReadStream.pipe stream
            catch err
                reject err

    writeToFile: (content, remotePath) ->
        new Promise Promise.coroutine (resolve, reject) =>
            sftp = yield @_getSftp()

            writeStream = sftp.createWriteStream remotePath
            writeStream.on 'finish', ->
                resolve()
            writeStream.write content, 'utf-8', (err) ->
                return reject err if err?
                writeStream.end()

    fileExists: Promise.coroutine (remotePath) ->
        sftp = yield @_getSftp()
        try
            stats = yield sftp.statAsync remotePath
            return true
        catch err
            if err.code is SFTP_STATUS_CODE.NO_SUCH_FILE
                return false
            throw err

    uploadFile: Promise.coroutine (localPath, remotePath) ->
        sftp = yield @_getSftp()
        yield sftp.fastPutAsync localPath, remotePath, {}

    downloadFile: Promise.coroutine (remotePath, localPath) ->
        sftp = yield @_getSftp()
        yield sftp.fastGetAsync remotePath, localPath, {}

    _getSftp: Promise.coroutine ->
        @_sftp ?= yield new Promise (resolve, reject) =>
            @connection.sftp (err, sftp) ->
                return reject err if err?

                Promise.promisifyAll sftp
                resolve sftp

        return @_sftp

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
