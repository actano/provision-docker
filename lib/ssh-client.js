'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProxiedSSHClient = exports.SSHClient = undefined;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _ssh = require('ssh2');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return _bluebird2.default.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

_bluebird2.default.promisifyAll(_ssh.Client.prototype);
_bluebird2.default.promisifyAll(_fs2.default);

class SSHClient {
  constructor(config) {
    this.config = config;
  }

  connect() {
    return new _bluebird2.default((resolve, reject) => {
      this.connection = new _ssh.Client();
      this.connection.on('ready', () => resolve(this)).on('error', err => reject(err)).connect(this.config);
    });
  }

  close() {
    return new _bluebird2.default(resolve => {
      this.connection.on('close', () => resolve(this)).end();
    });
  }

  exec(command) {
    var _this = this;

    return new _bluebird2.default((() => {
      var _ref = _asyncToGenerator(function* (resolve, reject) {
        try {
          const stream = yield _this.connection.execAsync(`sleep 0.2; ${command}`);
          stream.pipe(process.stdout);
          stream.stderr.pipe(process.stderr);
          stream.on('close', function (code) {
            return resolve(code);
          }).on('error', function (err) {
            return reject(err);
          });
        } catch (error) {
          reject(error);
        }
      });

      return function (_x, _x2) {
        return _ref.apply(this, arguments);
      };
    })());
  }

  execScript(pathToScript, args = [], opts = {}) {
    var _this2 = this;

    return new _bluebird2.default((() => {
      var _ref2 = _asyncToGenerator(function* (resolve, reject) {
        try {
          let command = `bash -s ${args.join(' ')}`;

          if (opts.sudo === true) {
            command = `sudo ${command}`;
          }

          const stream = yield _this2.connection.execAsync(command);
          stream.on('close', function (code) {
            return resolve(code);
          }).on('error', function (err) {
            return reject(err);
          });

          stream.pipe(process.stdout);
          stream.stderr.pipe(process.stderr);

          const scriptReadStream = _fs2.default.createReadStream(_path2.default.resolve(pathToScript));
          scriptReadStream.pipe(stream);
        } catch (error) {
          reject(error);
        }
      });

      return function (_x3, _x4) {
        return _ref2.apply(this, arguments);
      };
    })());
  }

  writeToFile(content, remotePath) {
    var _this3 = this;

    return new _bluebird2.default((() => {
      var _ref3 = _asyncToGenerator(function* (resolve, reject) {
        const sftp = yield _this3._getSftp();

        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on('finish', function () {
          return resolve();
        });

        writeStream.write(content, 'utf-8', function (err) {
          if (err != null) {
            reject(err);
            return;
          }
          writeStream.end();
        });
      });

      return function (_x5, _x6) {
        return _ref3.apply(this, arguments);
      };
    })());
  }

  readFromFile(remotePath) {
    var _this4 = this;

    return new _bluebird2.default((() => {
      var _ref4 = _asyncToGenerator(function* (resolve, reject) {
        const sftp = yield _this4._getSftp();

        let content = '';
        const readStream = sftp.createReadStream(remotePath);
        readStream.on('data', function (chunk) {
          content += chunk.toString();
        }).on('end', function () {
          resolve(content);
        }).on('error', reject);
      });

      return function (_x7, _x8) {
        return _ref4.apply(this, arguments);
      };
    })());
  }

  fileExists(remotePath) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const sftp = yield _this5._getSftp();
      try {
        yield sftp.statAsync(remotePath);
        return true;
      } catch (err) {
        if (err.code === _ssh.SFTP_STATUS_CODE.NO_SUCH_FILE) {
          return false;
        }
        throw err;
      }
    })();
  }

  uploadFile(localPath, remotePath) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      const sftp = yield _this6._getSftp();

      var _ref5 = yield _fs2.default.statAsync(localPath);

      let mode = _ref5.mode;
      // eslint-disable-next-line no-bitwise

      mode |= 0o200; // ensure that file is always writable by the owner, i.e. deploy tool

      yield sftp.fastPutAsync(localPath, remotePath, {});
      yield sftp.chmodAsync(remotePath, mode);
    })();
  }

  downloadFile(remotePath, localPath) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      const sftp = yield _this7._getSftp();
      yield sftp.fastGetAsync(remotePath, localPath, {});
    })();
  }

  _getSftp() {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      if (_this8._sftp == null) {
        _this8._sftp = yield new _bluebird2.default(function (resolve, reject) {
          _this8.connection.sftp(function (err, sftp) {
            if (err != null) {
              reject(err);
              return;
            }

            _bluebird2.default.promisifyAll(sftp);
            resolve(sftp);
          });
        });
      }

      return _this8._sftp;
    })();
  }
}

class ProxiedSSHClient extends SSHClient {
  constructor(proxyConfig, config) {
    super(config);

    this.proxyConfig = proxyConfig;
    this._host = config.host;
    this._port = config.port || 22;

    // eslint-disable-next-line no-param-reassign
    config.host = undefined;
    // eslint-disable-next-line no-param-reassign
    config.port = undefined;
  }

  connect() {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      if (_this9._host == null) {
        throw new Error('no host to proxy to given');
      }
      if (_this9._port == null) {
        throw new Error('no port to proxy to given');
      }

      _this9._proxyClient = new SSHClient(_this9.proxyConfig);
      yield _this9._proxyClient.connect();

      const proxyStream = yield _this9._proxyClient.connection.execAsync(`nc ${_this9._host} ${_this9._port}`);
      _this9.config.sock = proxyStream;
      yield SSHClient.prototype.connect.call(_this9);
    })();
  }

  close() {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      yield SSHClient.prototype.close.call(_this10);
      yield _this10._proxyClient.close();
    })();
  }
}

exports.SSHClient = SSHClient;
exports.ProxiedSSHClient = ProxiedSSHClient;