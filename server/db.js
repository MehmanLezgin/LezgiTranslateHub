const Pool = require('pg').Pool
const pool = new Pool({
    user: 'postgres',
    password: 'typedef1280',//process.env.DB_PASSWORD,
    host: 'localhost',
    port: 5432,
    database: 'lezgi_tr_hub'
})

module.exports = pool