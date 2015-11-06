Promise = require 'bluebird'
colors = require 'colors/safe'
_ = require 'lodash'
path = require 'path'

{SSHClient, ProxiedSSHClient} = require './ssh-client'
DockerClient = require './docker-client'

module.exports = (host, username, options = {}) ->
    {proxy} = options

    return {
        connect: Promise.coroutine ->
            if proxy?
                @sshClient = new ProxiedSSHClient
                    host: proxy
                    username: username
                    agent: process.env.SSH_AUTH_SOCK
                ,
                    host: host
                    username: username
                    agent: process.env.SSH_AUTH_SOCK
            else
                @sshClient = new SSHClient
                    host: host
                    username: username
                    agent: process.env.SSH_AUTH_SOCK

            yield @sshClient.connect()
            @dockerClient = new DockerClient @sshClient, username

        disconnect: Promise.coroutine ->
            yield @sshClient.close()

        ###
            Starts a new container from image `tag` with name `containerName`.
            Run configurations like port mapping and environment variables can be set
            via `runConfig`.
        ###
        runContainer: Promise.coroutine (tag, containerName, runConfig) ->
            _runConfig = _.extend {}, runConfig, {containerName, tag}
            if runConfig.assets?
                files = runConfig.assets.map (assetInfo) -> assetInfo.localPath
                targetDirectory = "/home/#{username}/assets"

                yield @uploadFiles files, targetDirectory

            yield @dockerClient.run _runConfig


        ###
            Execute a command` via ssh
        ###
        exec: Promise.coroutine (command) ->
            yield @sshClient.exec command

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

            isHealthy = yield @checkHealth host, healthCheckPort

            if isHealthy
                console.log colors.green "#{containerName} seems to be healthy"
                return

            console.log colors.yellow "#{containerName} seems to be down"
            console.log colors.green "replacing #{containerName}"

            yield @replaceContainer tag, containerName, runConfig

        ###
            Login to private docker registry located at `registryHost` via `username` and `password`.
        ###
        loginToRegistry: Promise.coroutine (registryHost, username, password) ->
            yield @dockerClient.login registryHost, username, password

        ###
            Docker related cleanup.
        ###
        cleanup: Promise.coroutine ->
            yield @dockerClient.removeDanglingImages()

        ###
            Checks if `port` is open on `host`.
        ###
        checkHealth: Promise.coroutine (host, port) ->
            exitCode = yield @sshClient.exec "nc -z #{host} #{port}"

            return true if exitCode is 0
            return false

        ###
            Uploads `files` to the remote directory `targetDirectory`.
        ###
        uploadFiles: Promise.coroutine (files, targetDirectory) ->
            exitCode = yield @sshClient.exec "mkdir -p #{targetDirectory}"
            unless exitCode is 0
                throw new Error "error while creating directory #{targetDirectory}"

            for file in files
                remotePath = path.join targetDirectory, path.basename file
                console.log colors.green "uploading file '#{file}' to remote path #{remotePath}"
                yield @sshClient.uploadFile file, remotePath

        ###
            Sends `signal` to container with name `containerName`.
        ###
        sendSignalToContainer: Promise.coroutine (containerName, signal) ->
            yield @dockerClient.sendSignalToContainer containerName, signal
    }
