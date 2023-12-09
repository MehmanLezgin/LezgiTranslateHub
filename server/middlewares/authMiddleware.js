const jwt = require('jsonwebtoken');
const db = require('../db')

module.exports = function(req, res, next) {
    if (req.method == 'OPTION') next();

    try {
        let token;
        try {
            token = req.headers.authorization?.split(' ')[1]?.trim();
        } catch (e2) {
            return res.status(401).send(req.msg.json.AUTH_REQUIRED);
        }   

        if (!token)
            return res.status(401).send(req.msg.json.AUTH_REQUIRED);

        const decodedData = jwt.verify(token, process.env.AUTH_SECRET);
        req.user = decodedData;

        db.query('SELECT is_banned FROM users WHERE id=$1 LIMIT 1', [req.user.id])
            .then(result => {
                if (result.rows[0]?.is_banned)
                    return res.status(403).send(req.msg.json.YOU_ARE_BANNED);
                else next();
            })

    } catch (e) {
        if (e instanceof jwt.JsonWebTokenError) {
            // Invalid token format or signature
            return res.status(401).send(req.msg.json.AUTH_REQUIRED);
        } else if (e instanceof jwt.TokenExpiredError) {
            // Token has expired
            return res.status(401).send(req.msg.json.AUTH_REQUIRED);
        }
        console.log(e);
        res.status(500).send(req.msg.json.SERVER_ERROR);
    }
}