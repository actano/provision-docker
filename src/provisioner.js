/* eslint-disable no-console */
import colors from 'colors/safe'
import path from 'path'

import { SSHClient, ProxiedSSHClient } from './ssh-client'
import DockerClient from './docker-client'

export default function (host, username, options = {}) {
  const { proxy, proxyUsername = username } = options

  return {
    async connect() {
      if (proxy != null) {
        this.sshClient = new ProxiedSSHClient(
          {
            host: proxy,
            username: proxyUsername,
            agent: process.env.SSH_AUTH_SOCK,
          },
          {
            host,
            username,
            agent: process.env.SSH_AUTH_SOCK,
          },
        )
      } else {
        this.sshClient = new SSHClient({
          host,
          username,
          agent: process.env.SSH_AUTH_SOCK,
        })
      }

      await this.sshClient.connect()
      this.dockerClient = new DockerClient(this.sshClient, username)
    },

    async disconnect() {
      await this.sshClient.close()
    },

    /*
        Starts a new container from image `tag` with name `containerName`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    async runContainer(tag, containerName, runConfig) {
      const _runConfig = { ...runConfig, containerName, tag }
      if (runConfig.assets != null) {
        const files = runConfig.assets.map(assetInfo => assetInfo.localPath)
        const targetDirectory = `/home/${username}/assets`

        await this.uploadFiles(files, targetDirectory)
      }

      await this.dockerClient.run(_runConfig)
    },


    /*
        Execute a command` via ssh
    */
    async exec(command) {
      return await this.sshClient.exec(command)
    },

    /*
        Pulls the image with the given `tag`.
    */
    async pullImage(tag) {
      await this.dockerClient.pull(tag)
    },

    /*
        Removes the container with the given `containerName`.
    */
    async removeContainer(containerName) {
      await this.dockerClient.stop(containerName)
      await this.dockerClient.rm(containerName)
    },

    /*
        Replaces the container `containerName` with a new container from image `tag`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    async replaceContainer(tag, containerName, runConfig) {
      await this.pullImage(tag)
      await this.removeContainer(containerName)
      await this.runContainer(tag, containerName, runConfig)
    },

    /*
        Ensures that a container is running by checking if `healthCheckPort` is open.
        Does nothing when port is open. Otherwise a new container `containerName`
        will be started from image `tag`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    async ensureContainer(healthCheckPort, tag, containerName, runConfig) {
      console.log(colors.green(`checking health of ${containerName}`))

      const isHealthy = await this.checkHealth(host, healthCheckPort)

      if (isHealthy) {
        console.log(colors.green(`${containerName} seems to be healthy`))
        return
      }

      console.log(colors.yellow(`${containerName} seems to be down`))
      console.log(colors.green(`replacing ${containerName}`))

      await this.replaceContainer(tag, containerName, runConfig)
    },

    /*
        Login to private docker registry located at `registryHost` via `username` and `password`.
    */
    async loginToRegistry(registryHost, registryUser, registryPassword) {
      await this.dockerClient.login(registryHost, registryUser, registryPassword)
    },

    /*
        Docker related cleanup.
    */
    async cleanup() {
      await this.dockerClient.removeDanglingImages()
    },

    /*
        Checks if `port` is open on `host`.
    */
    async checkHealth(_host, port) {
      const exitCode = await this.sshClient.exec(`nc -z ${_host} ${port}`)
      return exitCode === 0
    },

    /*
        Uploads `files` to the remote directory `targetDirectory`.
    */
    async uploadFiles(files, targetDirectory) {
      const exitCode = await this.sshClient.exec(`mkdir -p ${targetDirectory}`)
      if (exitCode !== 0) {
        throw new Error(`error while creating directory ${targetDirectory}`)
      }

      for (const file of files) {
        const remotePath = path.join(targetDirectory, path.basename(file))
        console.log(colors.green(`uploading file '${file}' to remote path ${remotePath}`))
        // eslint-disable-next-line no-await-in-loop
        await this.sshClient.uploadFile(file, remotePath)
      }
    },

    /*
        Download `file` from remote and save as `targetFile`.
    */
    async downloadFile(file, targetFile) {
      if (!(await this.sshClient.fileExists(file))) {
        throw new Error(`error while downloading file '${file}': File does not exist`)
      }

      console.log(colors.green(`downloading file '${file}' to local path ${targetFile}`))
      await this.sshClient.downloadFile(file, targetFile)
    },

    /*
        Sends `signal` to container with name `containerName`.
    */
    async sendSignalToContainer(containerName, signal) {
      await this.dockerClient.sendSignalToContainer(containerName, signal)
    },
  }
}
