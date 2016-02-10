path = require 'path'

Promise = require 'bluebird'
colors = require 'colors/safe'

class DockerClient
    constructor: (@sshClient, @username) ->

    run: Promise.coroutine (config) ->
        {containerName, tag} = config

        unless containerName?
            throw new Error 'missing container name'

        unless tag?
            throw new Error 'missing tag'

        config.ports ?= []
        config.environment ?= {}

        command = yield @_buildRunCommand config

        console.log colors.green "starting container via '#{command}'"

        yield @_execWithGuard command

    stop: Promise.coroutine (containerName) ->
        console.log colors.green "stopping container #{containerName}"
        yield @sshClient.exec "docker stop #{containerName}" # allow fail, container may not exist

    rm: Promise.coroutine (containerName) ->
        console.log colors.green "removing container #{containerName}"
        yield @sshClient.exec "docker rm -v #{containerName}" # allow fail, container may not exist

    pull: Promise.coroutine (tag) ->
        console.log colors.green "pulling image #{tag}"
        yield @_execWithGuard "docker pull #{tag}"

    removeDanglingImages: Promise.coroutine ->
        console.log colors.green 'removing dangling images'
        yield @sshClient.exec 'docker rmi `docker images -qf dangling=true`' # allow fail, when no danling images present

    login: Promise.coroutine (registryHost, registryUsername, password) ->
        console.log colors.green 'doing login for private registry'

        exists = yield @sshClient.fileExists "/home/#{@username}/.docker/config.json"
        if exists
            console.log colors.green 'already logged in'
            return

        token = new Buffer("#{registryUsername}:#{password}").toString 'base64'

        auth =
            auths: {}

        auth.auths[registryHost] =
            auth: token
            email: ''

        yield @_execWithGuard "mkdir -p /home/#{@username}/.docker"
        yield @sshClient.writeToFile JSON.stringify(auth), "/home/#{@username}/.docker/config.json"

    sendSignalToContainer: Promise.coroutine (containerName, signal) ->
        console.log colors.green "sending signal #{signal} to #{containerName}"
        yield @_execWithGuard "docker kill -s #{signal} #{containerName}"

    _writeEnvFile: Promise.coroutine (env, remotePath) ->
        contents = ''

        for key, value of env
            continue unless value?
            contents += "#{key}=#{value}\n"

        yield @sshClient.writeToFile contents, remotePath

    _buildRunCommand: Promise.coroutine (config) ->
        {containerName, ports, environment, tag, net, assets, restart, cmd, volumes, addHosts, limits} = config

        if Object.keys(environment).length > 0
            envFile = path.join "/home/#{@username}/#{containerName}.env"
            yield @_writeEnvFile environment, envFile

        command = "docker run -d --name #{containerName}"

        for port in ports
            command += " -p #{port}"

        if envFile?
            command += " --env-file #{envFile}"

        if net?
            command += " --net=#{net}"

        if restart?
            command += " --restart=#{restart}"

        if assets?
            for asset in assets
                remotePath = path.join "/home/#{@username}/assets", path.basename asset.localPath
                command += " -v #{remotePath}:#{asset.containerPath}"

        if volumes?
            for volume in volumes
                command += " -v #{volume}"

        if addHosts?
            for addHost in addHosts
                command += " --add-host #{addHost}"

        if limits?.memory?
            command += " --memory #{limits.memory}"

        command += " #{tag}"

        if cmd?
            command += " #{cmd}"

        return command

    _execWithGuard: Promise.coroutine (command) ->
        exitCode = yield @sshClient.exec command

        unless exitCode is 0
            throw new Error "command '#{command}' failed with exit code #{exitCode}"

module.exports = DockerClient
