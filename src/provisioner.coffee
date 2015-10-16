Promise = require 'bluebird'
colors = require 'colors/safe'
_ = require 'lodash'

{SSHClient} = require './ssh-client'
DockerClient = require './docker-client'
healthCheck = require './health-check'

module.exports = (host) ->
    return {
        connect: Promise.coroutine ->
            @sshClient = new SSHClient
                host: host
                username: 'vagrant'
                agent: process.env.SSH_AUTH_SOCK

            yield @sshClient.connect()
            @dockerClient = new DockerClient @sshClient

        disconnect: Promise.coroutine ->
            yield @sshClient.close()

        ###
            Starts a new container from image `tag` with name `containerName`.
            Run configurations like port mapping and environment variables can be set
            via `runConfig`.
        ###
        runContainer: Promise.coroutine (tag, containerName, runConfig) ->
            _runConfig = _.extend {}, runConfig, {containerName, tag}
            yield @dockerClient.run _runConfig

        ###
            Replaces the container `containerName` with a new container from image `tag`.
            Run configurations like port mapping and environment variables can be set
            via `runConfig`.
        ###
        replaceContainer: Promise.coroutine (tag, containerName, runConfig) ->
            yield @dockerClient.pull tag
            yield @dockerClient.stop containerName
            yield @dockerClient.rm containerName
            yield @runContainer tag, containerName, runConfig

        ###
            Ensures that a container is running by checking if `healthCheckPort` is open.
            Does nothing when port is open. Otherwise a new container `containerName`
            will be started from image `tag`.
            Run configurations like port mapping and environment variables can be set
            via `runConfig`.
        ###
        ensureContainer: Promise.coroutine (healthCheckPort, tag, containerName, runConfig) ->
            console.log colors.green "checking health of #{containerName}"

            isHealthy = yield healthCheck host, healthCheckPort

            if isHealthy
                console.log colors.green "#{containerName} seems to be healthy"
                return

            console.log colors.yellow "#{containerName} seems to be down"
            console.log colors.green "starting #{containerName}"

            yield @runContainer tag, containerName, runConfig

        ###
            Login to private docker registry via `username` and `password`.
        ###
        loginToRegistry: Promise.coroutine (registryHost, username, password) ->
            yield @dockerClient.login registryHost, username, password

        ###
            Docker related cleanup.
        ###
        cleanup: Promise.coroutine ->
            yield @dockerClient.removeDanglingImages()
    }