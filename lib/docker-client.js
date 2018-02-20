'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _safe = require('colors/safe');

var _safe2 = _interopRequireDefault(_safe);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /* eslint-disable
                                                                                                                                                                                                                                                                                                                                                                                                                                                                               no-console,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                           */


class DockerClient {
  constructor(sshClient, username) {
    this.sshClient = sshClient;
    this.username = username;
  }

  run(_config) {
    var _this = this;

    return _asyncToGenerator(function* () {
      const config = _extends({}, _config);
      const containerName = config.containerName,
            tag = config.tag;


      if (containerName == null) {
        throw new Error('missing container name');
      }

      if (tag == null) {
        throw new Error('missing tag');
      }

      if (config.ports == null) {
        config.ports = [];
      }
      if (config.environment == null) {
        config.environment = {};
      }

      const command = yield _this._buildRunCommand(config);

      console.log(_safe2.default.green(`starting container via '${command}'`));

      yield _this._execWithGuard(command);
    })();
  }

  stop(containerName) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green(`stopping container ${containerName}`));
      // allow fail, container may not exist
      yield _this2.sshClient.exec(`docker stop ${containerName}`);
    })();
  }

  rm(containerName) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green(`removing container ${containerName}`));
      // allow fail, container may not exist
      yield _this3.sshClient.exec(`docker rm -v ${containerName}`);
    })();
  }

  pull(tag) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green(`pulling image ${tag}`));
      yield _this4._execWithGuard(`docker pull ${tag}`);
    })();
  }

  removeDanglingImages() {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green('removing dangling images'));
      // allow fail, when no danling images present
      yield _this5.sshClient.exec('docker rmi `docker images -qf dangling=true`');
    })();
  }

  login(registryHost, registryUsername, password) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green('doing login for private registry'));
      const configPath = `/home/${_this6.username}/.docker/config.json`;

      let configContent = { auths: {} };
      const exists = yield _this6.sshClient.fileExists(configPath);

      if (exists) {
        console.log(_safe2.default.green('registry config file already exists'));

        try {
          configContent = JSON.parse((yield _this6.sshClient.readFromFile(configPath)));
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            throw err;
          }
          console.log(_safe2.default.yellow('unable to read registry config file. creating a new one'));
        }
      }

      const token = Buffer.from(`${registryUsername}:${password}`).toString('base64');

      configContent.auths[registryHost] = {
        auth: token,
        email: ''
      };

      yield _this6._execWithGuard(`mkdir -p /home/${_this6.username}/.docker`);
      yield _this6.sshClient.writeToFile(JSON.stringify(configContent), `/home/${_this6.username}/.docker/config.json`);
    })();
  }

  sendSignalToContainer(containerName, signal) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      console.log(_safe2.default.green(`sending signal ${signal} to ${containerName}`));
      yield _this7._execWithGuard(`docker kill -s ${signal} ${containerName}`);
    })();
  }

  _writeEnvFile(env, remotePath) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      let contents = '';

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Object.keys(env)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          const key = _step.value;

          const value = env[key];
          if (value != null) {
            contents += `${key}=${value}\n`;
          }
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

      yield _this8.sshClient.writeToFile(contents, remotePath);
    })();
  }

  _buildRunCommand(config) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      let envFile;
      const addCapabilities = config.addCapabilities,
            addHosts = config.addHosts,
            assets = config.assets,
            cmd = config.cmd,
            containerName = config.containerName,
            environment = config.environment,
            hostname = config.hostname,
            limits = config.limits,
            net = config.net,
            ports = config.ports,
            restart = config.restart,
            tag = config.tag,
            volumes = config.volumes;


      if (Object.keys(environment).length > 0) {
        envFile = _path2.default.join(`/home/${_this9.username}/${containerName}.env`);
        yield _this9._writeEnvFile(environment, envFile);
      }

      let command = `docker run -d --name ${containerName}`;

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = ports[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          const port = _step2.value;

          command += ` -p ${port}`;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      if (envFile != null) {
        command += ` --env-file ${envFile}`;
      }

      if (net != null) {
        command += ` --net=${net}`;
      }

      if (restart != null) {
        command += ` --restart=${restart}`;
      }

      if (assets != null) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = assets[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            const asset = _step3.value;

            const remotePath = _path2.default.join(`/home/${_this9.username}/assets`, _path2.default.basename(asset.localPath));
            command += ` -v ${remotePath}:${asset.containerPath}`;
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }

      if (volumes != null) {
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = volumes[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            const volume = _step4.value;

            command += ` -v ${volume}`;
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }
      }

      if (addHosts != null) {
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = addHosts[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            const addHost = _step5.value;

            command += ` --add-host ${addHost}`;
          }
        } catch (err) {
          _didIteratorError5 = true;
          _iteratorError5 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }
          } finally {
            if (_didIteratorError5) {
              throw _iteratorError5;
            }
          }
        }
      }

      if (hostname != null) {
        command += ` --hostname ${hostname}`;
      }

      if ((limits != null ? limits.memory : undefined) != null) {
        command += ` --memory ${limits.memory}`;
      }

      if (addCapabilities != null) {
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = addCapabilities[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            const addCapability = _step6.value;

            command += ` --cap-add ${addCapability}`;
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }
      }

      command += ` ${tag}`;

      if (cmd != null) {
        command += ` ${cmd}`;
      }

      return command;
    })();
  }

  _execWithGuard(command) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      const exitCode = yield _this10.sshClient.exec(command);

      if (exitCode !== 0) {
        throw new Error(`command '${command}' failed with exit code ${exitCode}`);
      }
    })();
  }
}

exports.default = DockerClient;