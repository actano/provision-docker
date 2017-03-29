// Generated by CoffeeScript 1.11.1
(function() {
  var Client, Promise, ProxiedSSHClient, SFTP_STATUS_CODE, SSHClient, fs, path, ref,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  fs = require('fs');

  path = require('path');

  Promise = require('bluebird');

  ref = require('ssh2'), Client = ref.Client, SFTP_STATUS_CODE = ref.SFTP_STATUS_CODE;

  Promise.promisifyAll(Client.prototype);

  Promise.promisifyAll(fs);

  SSHClient = (function() {
    function SSHClient(config1) {
      this.config = config1;
    }

    SSHClient.prototype.connect = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          _this.connection = new Client();
          return _this.connection.on('ready', function() {
            return resolve(_this);
          }).on('error', function(err) {
            return reject(err);
          }).connect(_this.config);
        };
      })(this));
    };

    SSHClient.prototype.close = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.connection.on('close', function() {
            return resolve(_this);
          }).end();
        };
      })(this));
    };

    SSHClient.prototype.exec = function(command) {
      return new Promise(Promise.coroutine((function(_this) {
        return function*(resolve, reject) {
          var err, stream;
          try {
            stream = (yield _this.connection.execAsync("sleep 0.2; " + command));
            stream.pipe(process.stdout);
            stream.stderr.pipe(process.stderr);
            return stream.on('close', function(code) {
              return resolve(code);
            }).on('error', function(err) {
              return reject(err);
            });
          } catch (error) {
            err = error;
            return reject(err);
          }
        };
      })(this)));
    };

    SSHClient.prototype.execScript = function(pathToScript, args, opts) {
      if (args == null) {
        args = [];
      }
      if (opts == null) {
        opts = {};
      }
      return new Promise(Promise.coroutine((function(_this) {
        return function*(resolve, reject) {
          var command, err, scriptReadStream, stream;
          try {
            command = "bash -s " + (args.join(' '));
            if (opts.sudo === true) {
              command = 'sudo ' + command;
            }
            stream = (yield _this.connection.execAsync(command));
            stream.on('close', function(code) {
              return resolve(code);
            }).on('error', function(err) {
              return reject(err);
            });
            stream.pipe(process.stdout);
            stream.stderr.pipe(process.stderr);
            scriptReadStream = fs.createReadStream(path.resolve(pathToScript));
            return scriptReadStream.pipe(stream);
          } catch (error) {
            err = error;
            return reject(err);
          }
        };
      })(this)));
    };

    SSHClient.prototype.writeToFile = function(content, remotePath) {
      return new Promise(Promise.coroutine((function(_this) {
        return function*(resolve, reject) {
          var sftp, writeStream;
          sftp = (yield _this._getSftp());
          writeStream = sftp.createWriteStream(remotePath);
          writeStream.on('finish', function() {
            return resolve();
          });
          return writeStream.write(content, 'utf-8', function(err) {
            if (err != null) {
              return reject(err);
            }
            return writeStream.end();
          });
        };
      })(this)));
    };

    SSHClient.prototype.fileExists = Promise.coroutine(function*(remotePath) {
      var err, sftp, stats;
      sftp = (yield this._getSftp());
      try {
        stats = (yield sftp.statAsync(remotePath));
        return true;
      } catch (error) {
        err = error;
        if (err.code === SFTP_STATUS_CODE.NO_SUCH_FILE) {
          return false;
        }
        throw err;
      }
    });

    SSHClient.prototype.uploadFile = Promise.coroutine(function*(localPath, remotePath) {
      var mode, sftp, stats;
      sftp = (yield this._getSftp());
      stats = (yield fs.statAsync(localPath));
      mode = stats['mode'];
      mode = mode | 0x80;
      yield sftp.fastPutAsync(localPath, remotePath, {});
      return (yield sftp.chmodAsync(remotePath, mode));
    });

    SSHClient.prototype.downloadFile = Promise.coroutine(function*(remotePath, localPath) {
      var sftp;
      sftp = (yield this._getSftp());
      return (yield sftp.fastGetAsync(remotePath, localPath, {}));
    });

    SSHClient.prototype._getSftp = Promise.coroutine(function*() {
      if (this._sftp == null) {
        this._sftp = (yield new Promise((function(_this) {
          return function(resolve, reject) {
            return _this.connection.sftp(function(err, sftp) {
              if (err != null) {
                return reject(err);
              }
              Promise.promisifyAll(sftp);
              return resolve(sftp);
            });
          };
        })(this)));
      }
      return this._sftp;
    });

    return SSHClient;

  })();

  ProxiedSSHClient = (function(superClass) {
    extend(ProxiedSSHClient, superClass);

    function ProxiedSSHClient(proxyConfig, config) {
      var ref1;
      this.proxyConfig = proxyConfig;
      this._host = config.host;
      this._port = (ref1 = config.port) != null ? ref1 : 22;
      config.host = void 0;
      config.port = void 0;
      ProxiedSSHClient.__super__.constructor.call(this, config);
    }

    ProxiedSSHClient.prototype.connect = Promise.coroutine(function*() {
      var proxyStream;
      if (this._host == null) {
        throw new Error('no host to proxy to given');
      }
      if (this._port == null) {
        throw new Error('no port to proxy to given');
      }
      this._proxyClient = new SSHClient(this.proxyConfig);
      yield this._proxyClient.connect();
      proxyStream = (yield this._proxyClient.connection.execAsync("nc " + this._host + " " + this._port));
      this.config.sock = proxyStream;
      return (yield SSHClient.prototype.connect.call(this));
    });

    ProxiedSSHClient.prototype.close = Promise.coroutine(function*() {
      yield SSHClient.prototype.close.call(this);
      return (yield this._proxyClient.close());
    });

    return ProxiedSSHClient;

  })(SSHClient);

  module.exports = {
    SSHClient: SSHClient,
    ProxiedSSHClient: ProxiedSSHClient
  };

}).call(this);