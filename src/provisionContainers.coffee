dcConfig = require './config'
Promise = require 'bluebird'
fs = require 'fs'
path = require 'path'
os = require 'os'
colors = require 'colors/safe'
SSHClient = require './ssh-client'
DockerClient = require './docker-client'

Promise.promisifyAll fs

do Promise.coroutine ->
    privateKey = yield fs.readFileAsync path.join os.homedir(), '.ssh/id_rsa'
    username = ''
    password = ''

    for name, config of dcConfig
        console.log colors.green "starting #{name}"

        client = new SSHClient
            host: config.ip
            username: 'vagrant'
            privateKey: privateKey

        yield client.connect()

        try
            dockerClient = new DockerClient client

            yield dockerClient.login username, password
            yield dockerClient.pull config.tag
            yield dockerClient.stop config.containerName
            yield dockerClient.rm config.containerName
            yield dockerClient.run config
            yield dockerClient.removeDanglingImages()
        finally
            yield client.close()
