module.exports = Object.assign({}, {
    Provisioner: require('./lib/provisioner')
}, require('./lib/ssh-client'));
