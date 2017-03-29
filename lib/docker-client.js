// Generated by CoffeeScript 1.11.1
(function() {
  var DockerClient, Promise, colors, path;

  path = require('path');

  Promise = require('bluebird');

  colors = require('colors/safe');

  DockerClient = (function() {
    function DockerClient(sshClient, username) {
      this.sshClient = sshClient;
      this.username = username;
    }

    DockerClient.prototype.run = Promise.coroutine(function*(config) {
      var command, containerName, tag;
      containerName = config.containerName, tag = config.tag;
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
      command = (yield this._buildRunCommand(config));
      console.log(colors.green("starting container via '" + command + "'"));
      return (yield this._execWithGuard(command));
    });

    DockerClient.prototype.stop = Promise.coroutine(function*(containerName) {
      console.log(colors.green("stopping container " + containerName));
      return (yield this.sshClient.exec("docker stop " + containerName));
    });

    DockerClient.prototype.rm = Promise.coroutine(function*(containerName) {
      console.log(colors.green("removing container " + containerName));
      return (yield this.sshClient.exec("docker rm -v " + containerName));
    });

    DockerClient.prototype.pull = Promise.coroutine(function*(tag) {
      console.log(colors.green("pulling image " + tag));
      return (yield this._execWithGuard("docker pull " + tag));
    });

    DockerClient.prototype.removeDanglingImages = Promise.coroutine(function*() {
      console.log(colors.green('removing dangling images'));
      return (yield this.sshClient.exec('docker rmi `docker images -qf dangling=true`'));
    });

    DockerClient.prototype.login = Promise.coroutine(function*(registryHost, registryUsername, password) {
      var auth, exists, token;
      console.log(colors.green('doing login for private registry'));
      exists = (yield this.sshClient.fileExists("/home/" + this.username + "/.docker/config.json"));
      if (exists) {
        console.log(colors.green('already logged in'));
        return;
      }
      token = new Buffer(registryUsername + ":" + password).toString('base64');
      auth = {
        auths: {}
      };
      auth.auths[registryHost] = {
        auth: token,
        email: ''
      };
      yield this._execWithGuard("mkdir -p /home/" + this.username + "/.docker");
      return (yield this.sshClient.writeToFile(JSON.stringify(auth), "/home/" + this.username + "/.docker/config.json"));
    });

    DockerClient.prototype.sendSignalToContainer = Promise.coroutine(function*(containerName, signal) {
      console.log(colors.green("sending signal " + signal + " to " + containerName));
      return (yield this._execWithGuard("docker kill -s " + signal + " " + containerName));
    });

    DockerClient.prototype._writeEnvFile = Promise.coroutine(function*(env, remotePath) {
      var contents, key, value;
      contents = '';
      for (key in env) {
        value = env[key];
        if (value == null) {
          continue;
        }
        contents += key + "=" + value + "\n";
      }
      return (yield this.sshClient.writeToFile(contents, remotePath));
    });

    DockerClient.prototype._buildRunCommand = Promise.coroutine(function*(config) {
      var addCapabilities, addCapability, addHost, addHosts, asset, assets, cmd, command, containerName, envFile, environment, i, j, k, l, len, len1, len2, len3, len4, limits, m, net, port, ports, remotePath, restart, tag, volume, volumes;
      addCapabilities = config.addCapabilities, addHosts = config.addHosts, assets = config.assets, cmd = config.cmd, containerName = config.containerName, environment = config.environment, limits = config.limits, net = config.net, ports = config.ports, restart = config.restart, tag = config.tag, volumes = config.volumes;
      if (Object.keys(environment).length > 0) {
        envFile = path.join("/home/" + this.username + "/" + containerName + ".env");
        yield this._writeEnvFile(environment, envFile);
      }
      command = "docker run -d --name " + containerName;
      for (i = 0, len = ports.length; i < len; i++) {
        port = ports[i];
        command += " -p " + port;
      }
      if (envFile != null) {
        command += " --env-file " + envFile;
      }
      if (net != null) {
        command += " --net=" + net;
      }
      if (restart != null) {
        command += " --restart=" + restart;
      }
      if (assets != null) {
        for (j = 0, len1 = assets.length; j < len1; j++) {
          asset = assets[j];
          remotePath = path.join("/home/" + this.username + "/assets", path.basename(asset.localPath));
          command += " -v " + remotePath + ":" + asset.containerPath;
        }
      }
      if (volumes != null) {
        for (k = 0, len2 = volumes.length; k < len2; k++) {
          volume = volumes[k];
          command += " -v " + volume;
        }
      }
      if (addHosts != null) {
        for (l = 0, len3 = addHosts.length; l < len3; l++) {
          addHost = addHosts[l];
          command += " --add-host " + addHost;
        }
      }
      if ((limits != null ? limits.memory : void 0) != null) {
        command += " --memory " + limits.memory;
      }
      if (addCapabilities != null) {
        for (m = 0, len4 = addCapabilities.length; m < len4; m++) {
          addCapability = addCapabilities[m];
          command += " --cap-add " + addCapability;
        }
      }
      command += " " + tag;
      if (cmd != null) {
        command += " " + cmd;
      }
      return command;
    });

    DockerClient.prototype._execWithGuard = Promise.coroutine(function*(command) {
      var exitCode;
      exitCode = (yield this.sshClient.exec(command));
      if (exitCode !== 0) {
        throw new Error("command '" + command + "' failed with exit code " + exitCode);
      }
    });

    return DockerClient;

  })();

  module.exports = DockerClient;

}).call(this);