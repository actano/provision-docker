fs = require 'fs'
path = require 'path'
os = require 'os'

Promise = require 'bluebird'
colors = require 'colors/safe'
portscanner = require 'portscanner'
_ = require 'lodash'

dcConfig = require './config'
{SSHClient} = require './ssh-client'
DockerClient = require './docker-client'
healthCheck = require './health-check'

Promise.promisifyAll fs
Promise.longStackTraces()

replaceContainer = Promise.coroutine (dockerClient, tag, containerName, runConfig) ->
    _runConfig = _.extend {}, runConfig, {containerName, tag}

    yield dockerClient.pull tag
    yield dockerClient.stop containerName
    yield dockerClient.rm containerName
    yield dockerClient.run _runConfig

do Promise.coroutine ->
    username = ''
    password = ''

    for name, config of dcConfig
        console.log colors.green "checking health of #{name}"

        isHealthy = yield healthCheck config.ip, config.healthCheckPort

        if isHealthy
            console.log colors.green "#{name} seems to be healthy"
            continue

        console.log colors.yellow "#{name} seems to be down"
        console.log colors.green "starting #{name}"

        sshClient = new SSHClient
            host: config.ip
            username: 'vagrant'
            agent: process.env.SSH_AUTH_SOCK

        yield sshClient.connect()

        try
            dockerClient = new DockerClient sshClient

            yield dockerClient.login username, password
            yield replaceContainer dockerClient, config.tag, config.containerName, config.runConfig
            yield dockerClient.removeDanglingImages()
        finally
            yield sshClient.close()
