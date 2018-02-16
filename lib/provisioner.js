'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function (host, username, options = {}) {
  const proxy = options.proxy;
  var _options$proxyUsernam = options.proxyUsername;
  const proxyUsername = _options$proxyUsernam === undefined ? username : _options$proxyUsernam;


  return {
    connect() {
      var _this = this;

      return _asyncToGenerator(function* () {
        if (proxy != null) {
          _this.sshClient = new _sshClient.ProxiedSSHClient({
            host: proxy,
            username: proxyUsername,
            agent: process.env.SSH_AUTH_SOCK
          }, {
            host,
            username,
            agent: process.env.SSH_AUTH_SOCK
          });
        } else {
          _this.sshClient = new _sshClient.SSHClient({
            host,
            username,
            agent: process.env.SSH_AUTH_SOCK
          });
        }

        yield _this.sshClient.connect();
        _this.dockerClient = new _dockerClient2.default(_this.sshClient, username);
      })();
    },

    disconnect() {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        yield _this2.sshClient.close();
      })();
    },

    /*
        Starts a new container from image `tag` with name `containerName`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    runContainer(tag, containerName, runConfig) {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        const _runConfig = _extends({}, runConfig, { containerName, tag });
        if (runConfig.assets != null) {
          const files = runConfig.assets.map(function (assetInfo) {
            return assetInfo.localPath;
          });
          const targetDirectory = `/home/${username}/assets`;

          yield _this3.uploadFiles(files, targetDirectory);
        }

        yield _this3.dockerClient.run(_runConfig);
      })();
    },

    /*
        Execute a command` via ssh
    */
    exec(command) {
      var _this4 = this;

      return _asyncToGenerator(function* () {
        return yield _this4.sshClient.exec(command);
      })();
    },

    /*
        Pulls the image with the given `tag`.
    */
    pullImage(tag) {
      var _this5 = this;

      return _asyncToGenerator(function* () {
        yield _this5.dockerClient.pull(tag);
      })();
    },

    /*
        Removes the container with the given `containerName`.
    */
    removeContainer(containerName) {
      var _this6 = this;

      return _asyncToGenerator(function* () {
        yield _this6.dockerClient.stop(containerName);
        yield _this6.dockerClient.rm(containerName);
      })();
    },

    /*
        Replaces the container `containerName` with a new container from image `tag`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    replaceContainer(tag, containerName, runConfig) {
      var _this7 = this;

      return _asyncToGenerator(function* () {
        yield _this7.pullImage(tag);
        yield _this7.removeContainer(containerName);
        yield _this7.runContainer(tag, containerName, runConfig);
      })();
    },

    /*
        Ensures that a container is running by checking if `healthCheckPort` is open.
        Does nothing when port is open. Otherwise a new container `containerName`
        will be started from image `tag`.
        Run configurations like port mapping and environment variables can be set
        via `runConfig`.
    */
    ensureContainer(healthCheckPort, tag, containerName, runConfig) {
      var _this8 = this;

      return _asyncToGenerator(function* () {
        console.log(_safe2.default.green(`checking health of ${containerName}`));

        const isHealthy = yield _this8.checkHealth(host, healthCheckPort);

        if (isHealthy) {
          console.log(_safe2.default.green(`${containerName} seems to be healthy`));
          return;
        }

        console.log(_safe2.default.yellow(`${containerName} seems to be down`));
        console.log(_safe2.default.green(`replacing ${containerName}`));

        yield _this8.replaceContainer(tag, containerName, runConfig);
      })();
    },

    /*
        Login to private docker registry located at `registryHost` via `username` and `password`.
    */
    loginToRegistry(registryHost, registryUser, registryPassword) {
      var _this9 = this;

      return _asyncToGenerator(function* () {
        yield _this9.dockerClient.login(registryHost, registryUser, registryPassword);
      })();
    },

    /*
        Docker related cleanup.
    */
    cleanup() {
      var _this10 = this;

      return _asyncToGenerator(function* () {
        yield _this10.dockerClient.removeDanglingImages();
      })();
    },

    /*
        Checks if `port` is open on `host`.
    */
    checkHealth(_host, port) {
      var _this11 = this;

      return _asyncToGenerator(function* () {
        const exitCode = yield _this11.sshClient.exec(`nc -z ${_host} ${port}`);
        return exitCode === 0;
      })();
    },

    /*
        Uploads `files` to the remote directory `targetDirectory`.
    */
    uploadFiles(files, targetDirectory) {
      var _this12 = this;

      return _asyncToGenerator(function* () {
        const exitCode = yield _this12.sshClient.exec(`mkdir -p ${targetDirectory}`);
        if (exitCode !== 0) {
          throw new Error(`error while creating directory ${targetDirectory}`);
        }

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            const file = _step.value;

            const remotePath = _path2.default.join(targetDirectory, _path2.default.basename(file));
            console.log(_safe2.default.green(`uploading file '${file}' to remote path ${remotePath}`));
            // eslint-disable-next-line no-await-in-loop
            yield _this12.sshClient.uploadFile(file, remotePath);
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      })();
    },

    /*
        Download `file` from remote and save as `targetFile`.
    */
    downloadFile(file, targetFile) {
      var _this13 = this;

      return _asyncToGenerator(function* () {
        if (!(yield _this13.sshClient.fileExists(file))) {
          throw new Error(`error while downloading file '${file}': File does not exist`);
        }

        console.log(_safe2.default.green(`downloading file '${file}' to local path ${targetFile}`));
        yield _this13.sshClient.downloadFile(file, targetFile);
      })();
    },

    /*
        Sends `signal` to container with name `containerName`.
    */
    sendSignalToContainer(containerName, signal) {
      var _this14 = this;

      return _asyncToGenerator(function* () {
        yield _this14.dockerClient.sendSignalToContainer(containerName, signal);
      })();
    }
  };
};

var _safe = require('colors/safe');

var _safe2 = _interopRequireDefault(_safe);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sshClient = require('./ssh-client');

var _dockerClient = require('./docker-client');

var _dockerClient2 = _interopRequireDefault(_dockerClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /* eslint-disable no-console */