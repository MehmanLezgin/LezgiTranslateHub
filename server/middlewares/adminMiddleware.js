const db = require('../db')

module.exports = function(req, res, next) {
    if (req.method == 'OPTION') next();

    try {
        const query = `SELECT admin_lvl FROM users WHERE username = $1;`;
        
        db.query(query, [req.user.username]).then(result => {
            const userData = result.rows[0];
            if (userData) {
                next();
            }else res.status(404).end();
        });
    } catch (e) {
        console.log(e);
        res.status(500).send({error: 'Server Error'});
    }
}