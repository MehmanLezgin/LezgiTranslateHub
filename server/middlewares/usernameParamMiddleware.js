const db = require('../db')

module.exports = function(req, res, next) {
    if (req.method == 'OPTION') return next();

    try {
        const query = `SELECT id FROM users WHERE username = $1`;
        
        let username = req?.params?.username;
        if (!username || username == '0') username = req.user.username;

        db.query(query, [username]).then(result => {
            const userData = result.rows[0];
            if (userData) {
                req.params.username = username;
                req.params.id_by_username = userData.id;
                next();
            }else res.status(404).json(req.msg.json.USER_NOT_FOUND);
        });
    } catch (e) {
        console.log(e);
        res.status(500).send({error: 'Server Error'});
    }
}