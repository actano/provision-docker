Promise = require 'bluebird'
{Client} = require 'ssh2'

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

module.exports = SSHClient
