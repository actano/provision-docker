dcConfig = require './config'
{Client} = require 'ssh2'
Promise = require 'bluebird'
fs = require 'fs'
path = require 'path'
os = require 'os'
colors = require 'colors/safe'
Promise.promisifyAll fs
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
                        resolve code
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

class DockerClient
    constructor: (@sshClient) ->

    run: Promise.coroutine ({containerName, ports, environment, tag}) ->
        unless containerName?
            throw new Error 'missing container name'

        unless tag?
            throw new Error 'missing tag'

        ports ?= []
        environment ?= {}

        command = "docker run -d --name #{containerName}"

        for port in ports
            command += " -p #{port}"

        for key, value of environment
            command += " -e #{key}=#{value}"

        command += " #{tag}"

        console.log colors.green "starting container via '#{command}'"

        yield @sshClient.exec command

    stop: Promise.coroutine (containerName) ->
        console.log colors.green "stopping container #{containerName}"
        yield @sshClient.exec "docker stop #{containerName}"

    rm: Promise.coroutine (containerName) ->
        console.log colors.green "removing container #{containerName}"
        yield @sshClient.exec "docker rm -v #{containerName}"

    pull: Promise.coroutine (tag) ->
        console.log colors.green "pulling image #{tag}"
        yield @sshClient.exec "docker pull #{tag}"

    removeDanglingImages: Promise.coroutine ->
        console.log colors.green "removing dangling images"
        yield @sshClient.exec "docker rmi `docker images -qf dangling=true`"

do Promise.coroutine ->
    privateKey = yield fs.readFileAsync path.join os.homedir(), '.ssh/id_rsa'

    auth =
        auths:
            'my.docker.registry':
                auth: ''
                email: ''

    for name, config of dcConfig
        console.log colors.green "starting #{name}"

        client = new SSHClient
            host: config.ip
            username: 'vagrant'
            privateKey: privateKey

        yield client.connect()

        yield client.exec 'mkdir -p /home/vagrant/.docker'
        yield client.writeToFile JSON.stringify(auth), '/home/vagrant/.docker/config.json'

        dockerClient = new DockerClient client
        yield dockerClient.pull config.tag
        yield dockerClient.stop config.containerName
        yield dockerClient.rm config.containerName
        yield dockerClient.run config
        yield dockerClient.removeDanglingImages()

        yield client.close()
