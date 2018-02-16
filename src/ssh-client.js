import fs from 'fs'
import path from 'path'
import Promise from 'bluebird'
import { Client, SFTP_STATUS_CODE } from 'ssh2'

Promise.promisifyAll(Client.prototype)
Promise.promisifyAll(fs)

class SSHClient {
  constructor(config) {
    this.config = config
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection = new Client()
      this.connection
        .on('ready', () => resolve(this))
        .on('error', err => reject(err))
        .connect(this.config)
    })
  }

  close() {
    return new Promise((resolve) => {
      this.connection
        .on('close', () => resolve(this))
        .end()
    })
  }

  exec(command) {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.connection.execAsync(`sleep 0.2; ${command}`)
        stream.pipe(process.stdout)
        stream.stderr.pipe(process.stderr)
        stream
          .on('close', code => resolve(code))
          .on('error', err => reject(err))
      } catch (error) {
        reject(error)
      }
    })
  }

  execScript(pathToScript, args = [], opts = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        let command = `bash -s ${args.join(' ')}`

        if (opts.sudo === true) {
          command = `sudo ${command}`
        }

        const stream = await this.connection.execAsync(command)
        stream
          .on('close', code => resolve(code))
          .on('error', err => reject(err))

        stream.pipe(process.stdout)
        stream.stderr.pipe(process.stderr)

        const scriptReadStream = fs.createReadStream(path.resolve(pathToScript))
        scriptReadStream.pipe(stream)
      } catch (error) {
        reject(error)
      }
    })
  }

  writeToFile(content, remotePath) {
    return new Promise(async (resolve, reject) => {
      const sftp = await this._getSftp()

      const writeStream = sftp.createWriteStream(remotePath)
      writeStream
        .on('finish', () => resolve())

      writeStream.write(content, 'utf-8', (err) => {
        if (err != null) {
          reject(err)
          return
        }
        writeStream.end()
      })
    })
  }

  readFromFile(remotePath) {
    return new Promise(async (resolve, reject) => {
      const sftp = await this._getSftp()

      let content = ''
      const readStream = sftp.createReadStream(remotePath)
      readStream
        .on('data', (chunk) => {
          content += chunk.toString()
        })
        .on('end', () => {
          resolve(content)
        })
        .on('error', reject)
    })
  }

  async fileExists(remotePath) {
    const sftp = await this._getSftp()
    try {
      await sftp.statAsync(remotePath)
      return true
    } catch (err) {
      if (err.code === SFTP_STATUS_CODE.NO_SUCH_FILE) {
        return false
      }
      throw err
    }
  }

  async uploadFile(localPath, remotePath) {
    const sftp = await this._getSftp()
    let { mode } = await fs.statAsync(localPath)
    // eslint-disable-next-line no-bitwise
    mode |= 0o200 // ensure that file is always writable by the owner, i.e. deploy tool

    await sftp.fastPutAsync(localPath, remotePath, {})
    await sftp.chmodAsync(remotePath, mode)
  }

  async downloadFile(remotePath, localPath) {
    const sftp = await this._getSftp()
    await sftp.fastGetAsync(remotePath, localPath, {})
  }

  async _getSftp() {
    if (this._sftp == null) {
      this._sftp = await new Promise((resolve, reject) => {
        this.connection.sftp((err, sftp) => {
          if (err != null) {
            reject(err)
            return
          }

          Promise.promisifyAll(sftp)
          resolve(sftp)
        })
      })
    }

    return this._sftp
  }
}

class ProxiedSSHClient extends SSHClient {
  constructor(proxyConfig, config) {
    super(config)

    this.proxyConfig = proxyConfig
    this._host = config.host
    this._port = config.port || 22

    // eslint-disable-next-line no-param-reassign
    config.host = undefined
    // eslint-disable-next-line no-param-reassign
    config.port = undefined
  }

  async connect() {
    if (this._host == null) {
      throw new Error('no host to proxy to given')
    }
    if (this._port == null) {
      throw new Error('no port to proxy to given')
    }

    this._proxyClient = new SSHClient(this.proxyConfig)
    await this._proxyClient.connect()

    const proxyStream = await this._proxyClient.connection.execAsync(`nc ${this._host} ${this._port}`)
    this.config.sock = proxyStream
    await super.connect()
  }

  async close() {
    await super.close()
    await this._proxyClient.close()
  }
}

export {
  SSHClient,
  ProxiedSSHClient,
}
