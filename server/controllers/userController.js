const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const settings = require('../settings');
const db = require('../db');

const checkLength = (n, min, max) => n >= min && n <= max;

const isValidEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

const isValidName = (name) => {
    const nameRegex = /^[\p{L}\s'-]+$/u;
    return nameRegex.test(name);
}

async function isUsernameTaken(username) {
    const query = 'SELECT COUNT(*) AS username_count FROM users WHERE username = $1';
    const result = await db.query(query, [username]);
    return result.rows[0].username_count != 0;
}

async function isEmailTaken(email) {
    const query = 'SELECT COUNT(*) AS email_count FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0].email_count != 0;
}

const isValidUsername = (username) => {
    const regex = /^[A-Za-z0-9_]+$/;
    return regex.test(username);
}


const validUserData = (body, lang) => {
    const { username, fullname, email, password } = body;
  
    const errors = [];

    if (!username) {
        errors.push({ field: 'username', message: 'username_err' });
    } else if (!checkLength(username.length, settings.USERNAME_MIN_LEN, settings.USERNAME_MAX_LEN)) {
        errors.push({ field: 'username', message: 'username_len_err' });
    } else if (!isValidUsername(username)) {
        errors.push({ field: 'username', message: 'username_format_err' });
    }

    if (!fullname) {
        errors.push({ field: 'fullname', message: 'name_err' });
    } else if (!checkLength(fullname.length, settings.NAME_MIN_LEN, settings.NAME_MAX_LEN)) {
        errors.push({ field: 'fullname', message: 'name_len_err' });
    } else if (!isValidName(fullname)) {
        errors.push({ field: 'fullname', message: 'name_format_err' });
    }

    if (!email) {
        errors.push({ field: 'email', message: 'email_err' });
    } else if (!isValidEmail(email)) {
        errors.push({ field: 'email', message: 'email_format_err' });
    }

    if (!password) {
        errors.push({ field: 'password', message: 'password_err' });
    } else if (!checkLength(password.length, settings.PASSWORD_MIN_LEN, settings.PASSWORD_MAX_LEN)) {
        errors.push({ field: 'password', message: 'password_len_err' });
    }

    return errors;
};

const generateAccessToken = (id, username) => {
    const payload = { id, username };
    return jwt.sign(payload, process.env.AUTH_SECRET, { expiresIn: settings.PASSWORD_EXPIRES_IN });
};

const generateRegAccessToken = (username) => {
    const payload = { username };
    return jwt.sign(payload, process.env.REG_KEY_SECRET, { expiresIn: settings.REG_TOKEN_EXPIRES_IN });
};

class UserController {
    async signin(req, res) {
        try {
            let { username, email, password } = req.body;
            username = username?.trim();
            email = email?.trim();
            password = password?.trim();
            
            if ((!username?.length && !email?.length) || !password?.length)
                return res.status(400).json({ msg: 'Empty data' })

            const query = `SELECT id, username, password_hash FROM users WHERE ${username?'username':'email'} = $1;`;
            const result = await db.query(query, [username?username:email]);
            
            const userData = result.rows[0];
            if (!userData) {
                return res.status(400).json({ msg: 'Wrong login or password 1' });
            }
            
            const isPasswordValid = await bcrypt.compare(password, userData.password_hash);

            if (!isPasswordValid)
                return res.status(400).json({ msg: 'Wrong login or password 2' });

            const token = generateAccessToken(userData.id, userData.username);
            return res.status(200).json({token});
            
        } catch (e) {
            console.log(e);
            res.status(500).json({error: 'Server Error'});
        }
    }

    async signup(req, res) {
        try {
            const token = req.body.token?.trim();
            const decodedData = jwt.verify(token, process.env.REG_KEY_SECRET);
            // TODO: check if username from decodedData taken

            const userData = {
                username: decodedData.username?.trim(),
                fullname: req.body.fullname?.trim(),
                email: req.body.email?.trim(),
                password: req.body.password?.trim(),
            }

            const errors = validUserData(userData);

            if (errors.length) {
                return res.status(400).json({ errors })
            }

            // is username taken
            if (await isUsernameTaken(userData.username)) {
                return res.status(400).json({msg: 'Username taken'})
            }
            
            // is email taken
            
            if (await isEmailTaken(userData.email)) {
                return res.status(400).json({msg: 'Email taken'})
            }
            
            const hashPassword = bcrypt.hashSync(userData.password, 7);
            const newUser = await db.query('INSERT INTO users (username,fullname,email,password_hash) VALUES ($1,$2,$3,$4)',
                [userData.username, userData.fullname, userData.email, hashPassword]
                )

            res.status(200).json(newUser.rows[0]);
        } catch (e) {
            if (e instanceof jwt.JsonWebTokenError) {
                res.status(400).json({message: 'Invalid token'});
            }else {
                console.log(e);
                res.status(500).json({error: 'Server Error'});
            }
        }
    }

    async createRegToken(req, res) {
        try {
            const username = req.body?.username;
            if (!username || username.length < settings.USERNAME_MIN_LEN || username.length > settings.USERNAME_MAX_LEN) {
                return res.status(400).json({msg: 'Invalid username'});
            }

            // is username taken
            if (await isUsernameTaken(username))
                return res.status(400).json({msg: 'Username taken'})

            res.status(200).json({token: generateRegAccessToken(username)})
        }catch(e) {
            console.log(e);
            res.status(500).json({error: 'Server Error'});
        }
    }
}

module.exports = new UserController();