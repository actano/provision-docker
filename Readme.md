# provision-docker

Easy, automatic provisioning of `docker` containers.

## **Disclaimer**

This library is potentially insecure. It directly executes commands on a remote machine via SSH.
There's no protection against malicious input which exploits the intended behaviour.

**Use at your own risk.**

## General

This library provides an API for provisioning of `docker` containers on remote hosts via SSH. An SSH agent for
authentication is mandatory by setting the environment variable `SSH_AUTH_SOCK`.

## API

### Provisioner

#### `Provisioner(host, username, options) -> Provisioner`

Creates a new provisioner for the given `host` using `username` for SSH login.
Options:
* An SSH `proxy` can be configured optionally if `host` is not
directly accessible.

#### `.connect() -> Promise`

Establishes a new connection to the host, ready to provision containers.

#### `.disconnect() -> Promise`

Closes the connection to the host. Make sure to always call `disconnect` when finished with provisioning tasks.

#### `.runContainer(tag, containerName, runConfig) -> Promise`

Starts a new container from image `tag` with name `containerName`. Run configurations like port mapping and environment
variables can be set via `runConfig`.

#### `.replaceContainer(tag, containerName, runConfig) -> Promise`

Replaces the container `containerName` with a new container from image `tag`. Run configurations like port mapping and
environment variables can be set via `runConfig`.

#### `.ensureContainer(healthCheckPort, tag, containerName, runConfig) -> Promise`

Ensures that a container is running by checking if `healthCheckPort` is open. Does nothing when port is open. Otherwise
a new container `containerName` will be started from image `tag`. Run configurations like port mapping and environment
variables can be set via `runConfig`.

#### `.loginToRegistry(registryHost, username, password) -> Promise`

Login to private docker registry located at `registryHost` via `username` and `password`.

#### `.cleanup() -> Promise`

Docker related cleanup:
* remove dangling images

#### `.healthCheck(host, port) -> Promise`

Checks if `port` is open on `host`.

#### `.uploadFiles(files, targetDirectory) -> Promise`

Uploads `files` to the remote directory `targetDirectory`.

#### `runConfig`

The following properties can be set:
* `ports: [<p_1>, ..., <p_n>]` - adds port configuration to the `docker run` command, i.e. `-p <p_1> [...] -p <p_n>`
* `environment: {...}` - defines environment variables for the container, an env file `<container name>.env` will be
created on the remote host which is used by the `docker run` command
* `net: <network mode>` - defines the network mode of the container, i.e. `--net=<network mode>` for the `docker run`
command
* `assets: [{localPath: ..., containerPath: ...}, ...]` - defines asset files which are uploaded to the remote host and
mounted in the container under `containerPath`
