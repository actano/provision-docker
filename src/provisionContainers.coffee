fs = require 'fs'
path = require 'path'
os = require 'os'

Promise = require 'bluebird'
colors = require 'colors/safe'

dcConfig = require './config'
SSHClient = require './ssh-client'
DockerClient = require './docker-client'

Promise.promisifyAll fs

do Promise.coroutine ->
    username = ''
    password = ''

    for name, config of dcConfig
        console.log colors.green "starting #{name}"

        client = new SSHClient
            host: config.ip
            username: 'vagrant'
            agent: process.env.SSH_AUTH_SOCK

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
