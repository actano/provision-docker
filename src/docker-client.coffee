path = require 'path'

Promise = require 'bluebird'
colors = require 'colors/safe'

class DockerClient
    constructor: (@sshClient, @username) ->

    run: Promise.coroutine ({containerName, ports, environment, tag, net, assets}) ->
        unless containerName?
            throw new Error 'missing container name'

        unless tag?
            throw new Error 'missing tag'

        ports ?= []
        environment ?= {}

        command = yield @_buildRunCommand containerName, ports, environment, tag, net, assets

        console.log colors.green "starting container via '#{command}'"

        yield @sshClient.exec command

    stop: Promise.coroutine (containerName) ->
        console.log colors.green "stopping container #{containerName}"
        try
            yield @sshClient.exec "docker stop #{containerName}"
        catch err # allow fail, container may not exist

    rm: Promise.coroutine (containerName) ->
        console.log colors.green "removing container #{containerName}"
        try
            yield @sshClient.exec "docker rm -v #{containerName}"
        catch err # allow fail, container may not exist

    pull: Promise.coroutine (tag) ->
        console.log colors.green "pulling image #{tag}"
        yield @sshClient.exec "docker pull #{tag}"

    removeDanglingImages: Promise.coroutine ->
        console.log colors.green 'removing dangling images'
        try
            yield @sshClient.exec 'docker rmi `docker images -qf dangling=true`'
        catch err # allow fail, when no danling images present

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

        yield @sshClient.exec "mkdir -p /home/#{@username}/.docker"
        yield @sshClient.writeToFile JSON.stringify(auth), "/home/#{@username}/.docker/config.json"

    _writeEnvFile: Promise.coroutine (env, remotePath) ->
        contents = ''

        for key, value of env
            continue unless value?
            contents += "#{key}=#{value}\n"

        yield @sshClient.writeToFile contents, remotePath

    _uploadAssets: Promise.coroutine (assets) ->
        uploadPath = "/home/#{@username}/assets"
        yield @sshClient.exec "mkdir -p #{uploadPath}"

        for asset in assets
            remotePath = path.join uploadPath, path.basename asset.localPath
            console.log colors.green "uploading asset '#{asset.localPath}' to remote path #{remotePath}"
            yield @sshClient.uploadFile asset.localPath, remotePath

    _buildRunCommand: Promise.coroutine (containerName, ports, environment, tag, net, assets) ->
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

        if assets?
            yield @_uploadAssets assets

            for asset in assets
                remotePath = path.join "/home/#{@username}/assets", path.basename asset.localPath
                command += " -v #{remotePath}:#{asset.containerPath}"

        command += " #{tag}"

        return command

module.exports = DockerClient
