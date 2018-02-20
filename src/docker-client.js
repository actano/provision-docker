/* eslint-disable
    no-console,
*/
import path from 'path'
import colors from 'colors/safe'

class DockerClient {
  constructor(sshClient, username) {
    this.sshClient = sshClient
    this.username = username
  }

  async run(_config) {
    const config = { ..._config }
    const { containerName, tag } = config

    if (containerName == null) {
      throw new Error('missing container name')
    }

    if (tag == null) {
      throw new Error('missing tag')
    }

    if (config.ports == null) { config.ports = [] }
    if (config.environment == null) { config.environment = {} }

    const command = await this._buildRunCommand(config)

    console.log(colors.green(`starting container via '${command}'`))

    await this._execWithGuard(command)
  }

  async stop(containerName) {
    console.log(colors.green(`stopping container ${containerName}`))
    // allow fail, container may not exist
    await this.sshClient.exec(`docker stop ${containerName}`)
  }

  async rm(containerName) {
    console.log(colors.green(`removing container ${containerName}`))
    // allow fail, container may not exist
    await this.sshClient.exec(`docker rm -v ${containerName}`)
  }

  async pull(tag) {
    console.log(colors.green(`pulling image ${tag}`))
    await this._execWithGuard(`docker pull ${tag}`)
  }

  async removeDanglingImages() {
    console.log(colors.green('removing dangling images'))
    // allow fail, when no danling images present
    await this.sshClient.exec('docker rmi `docker images -qf dangling=true`')
  }

  async login(registryHost, registryUsername, password) {
    console.log(colors.green('doing login for private registry'))
    const configPath = `/home/${this.username}/.docker/config.json`

    let configContent = { auths: {} }
    const exists = await this.sshClient.fileExists(configPath)

    if (exists) {
      console.log(colors.green('registry config file already exists'))

      try {
        configContent = JSON.parse(await this.sshClient.readFromFile(configPath))
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          throw err
        }
        console.log(colors.yellow('unable to read registry config file. creating a new one'))
      }
    }

    const token = Buffer.from(`${registryUsername}:${password}`).toString('base64')

    configContent.auths[registryHost] = {
      auth: token,
      email: '',
    }

    await this._execWithGuard(`mkdir -p /home/${this.username}/.docker`)
    await this.sshClient.writeToFile(JSON.stringify(configContent), `/home/${this.username}/.docker/config.json`)
  }

  async sendSignalToContainer(containerName, signal) {
    console.log(colors.green(`sending signal ${signal} to ${containerName}`))
    await this._execWithGuard(`docker kill -s ${signal} ${containerName}`)
  }

  async _writeEnvFile(env, remotePath) {
    let contents = ''

    for (const key of Object.keys(env)) {
      const value = env[key]
      if (value != null) {
        contents += `${key}=${value}\n`
      }
    }

    await this.sshClient.writeToFile(contents, remotePath)
  }

  async _buildRunCommand(config) {
    let envFile
    const {
      addCapabilities,
      addHosts,
      assets,
      cmd,
      containerName,
      environment,
      hostname,
      limits,
      net,
      ports,
      restart,
      tag,
      volumes,
    } = config

    if (Object.keys(environment).length > 0) {
      envFile = path.join(`/home/${this.username}/${containerName}.env`)
      await this._writeEnvFile(environment, envFile)
    }

    let command = `docker run -d --name ${containerName}`

    for (const port of ports) {
      command += ` -p ${port}`
    }

    if (envFile != null) {
      command += ` --env-file ${envFile}`
    }

    if (net != null) {
      command += ` --net=${net}`
    }

    if (restart != null) {
      command += ` --restart=${restart}`
    }

    if (assets != null) {
      for (const asset of assets) {
        const remotePath = path.join(`/home/${this.username}/assets`, path.basename(asset.localPath))
        command += ` -v ${remotePath}:${asset.containerPath}`
      }
    }

    if (volumes != null) {
      for (const volume of volumes) {
        command += ` -v ${volume}`
      }
    }

    if (addHosts != null) {
      for (const addHost of addHosts) {
        command += ` --add-host ${addHost}`
      }
    }

    if (hostname != null) {
      command += ` --hostname ${hostname}`
    }

    if ((limits != null ? limits.memory : undefined) != null) {
      command += ` --memory ${limits.memory}`
    }

    if (addCapabilities != null) {
      for (const addCapability of addCapabilities) {
        command += ` --cap-add ${addCapability}`
      }
    }

    command += ` ${tag}`

    if (cmd != null) {
      command += ` ${cmd}`
    }

    return command
  }

  async _execWithGuard(command) {
    const exitCode = await this.sshClient.exec(command)

    if (exitCode !== 0) {
      throw new Error(`command '${command}' failed with exit code ${exitCode}`)
    }
  }
}

export default DockerClient
