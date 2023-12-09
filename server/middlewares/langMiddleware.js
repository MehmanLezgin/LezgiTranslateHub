const messages = require('../messages');

module.exports = function(req, res, next) {
    if (req.method == 'OPTION') next();

    try {
        req.msg = messages;
        next()
    } catch (e) {
        console.log(e);
    }
}