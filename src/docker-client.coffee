path = require 'path'

Promise = require 'bluebird'
colors = require 'colors/safe'

class DockerClient
    constructor: (@sshClient) ->

    run: Promise.coroutine ({containerName, ports, environment, tag}) ->
        unless containerName?
            throw new Error 'missing container name'

        unless tag?
            throw new Error 'missing tag'

        ports ?= []
        environment ?= {}

        if Object.keys(environment).length > 0
            envFile = path.join "/home/vagrant/#{containerName}.env"
            yield @_writeEnvFile environment, envFile

        command = "docker run -d --name #{containerName}"

        for port in ports
            command += " -p #{port}"

        if envFile?
            command += " --env-file #{envFile}"

        command += " #{tag}"

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
        console.log colors.green "removing dangling images"
        try
            yield @sshClient.exec "docker rmi `docker images -qf dangling=true`"
        catch err # allow fail, when no danling images present

    login: Promise.coroutine (username, password) ->
        console.log colors.green "doing login for private registry"

        token = new Buffer("#{username}:#{password}").toString 'base64'

        auth =
            auths:
                'docker.actano.de':
                    auth: token
                    email: ''

        yield @sshClient.exec 'mkdir -p /home/vagrant/.docker'
        yield @sshClient.writeToFile JSON.stringify(auth), '/home/vagrant/.docker/config.json'

    _writeEnvFile: Promise.coroutine (env, remotePath) ->
        contents = ''

        for key, value of env
            contents += "#{key}=#{value}\n"

        yield @sshClient.writeToFile contents, remotePath

module.exports = DockerClient