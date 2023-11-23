const jwt = require('jsonwebtoken');

const auth_req_msg = 'Authorization required';

module.exports = function(req, res, next) {
    if (req.method == 'OPTION') next();

    try {
        let token;
        try {
            token = req.headers.authorization?.split(' ')[1]?.trim();
        } catch (e2) {
            return res.status(401).send({ auth_req_msg });
        }

        if (!token)
            return res.status(401).send({ auth_req_msg });

        const decodedData = jwt.verify(token, process.env.AUTH_SECRET);
        req.user = decodedData;
        next();
    } catch (e) {
        if (e instanceof jwt.JsonWebTokenError) {
            // Invalid token format or signature
            return res.status(401).send({ auth_req_msg });
        } else if (e instanceof jwt.TokenExpiredError) {
            // Token has expired
            return res.status(401).send({ auth_req_msg });
        }
        console.log(e);
        res.status(500).send({error: 'Server Error'});
    }
}