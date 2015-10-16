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

runContainer = Promise.coroutine (dockerClient, tag, containerName, runConfig) ->
    _runConfig = _.extend {}, runConfig, {containerName, tag}
    yield dockerClient.run _runConfig

replaceContainer = Promise.coroutine (dockerClient, tag, containerName, runConfig) ->
    yield dockerClient.pull tag
    yield dockerClient.stop containerName
    yield dockerClient.rm containerName
    yield runContainer dockerClient, tag, containerName, runConfig

ensureContainer = Promise.coroutine (dockerClient, host, healthCheckPort, tag, containerName, runConfig) ->
    console.log colors.green "checking health of #{containerName}"

    isHealthy = yield healthCheck host, healthCheckPort

    if isHealthy
        console.log colors.green "#{containerName} seems to be healthy"
        return

    console.log colors.yellow "#{containerName} seems to be down"
    console.log colors.green "starting #{containerName}"

    yield runContainer dockerClient, tag, containerName, runConfig

loginToRegistry = Promise.coroutine (dockerClient, username, password) ->
    yield dockerClient.login username, password

cleanup = Promise.coroutine (dockerClient) ->
    yield dockerClient.removeDanglingImages()

do Promise.coroutine ->
    username = ''
    password = ''

    for name, config of dcConfig
        sshClient = new SSHClient
            host: config.ip
            username: 'vagrant'
            agent: process.env.SSH_AUTH_SOCK

        yield sshClient.connect()

        try
            dockerClient = new DockerClient sshClient

            yield loginToRegistry dockerClient, username, password
            yield replaceContainer dockerClient, config.tag, config.containerName, config.runConfig
            yield cleanup dockerClient
        finally
            yield sshClient.close()
