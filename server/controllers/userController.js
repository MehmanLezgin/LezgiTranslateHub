const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const settings = require('../settings');
const db = require('../db');
const utils = require('../utils');

const checkLength = (n, min, max) => n >= min && n <= max;

const emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

function isValidEmail(email) {
    if (!email) return false;

    if (email.length > 254) return false;

    if (!emailRegex.test(email)) return false;

    const parts = email.split("@");
    if (parts[0].length > 64) return false;

    const domainParts = parts[1].split(".");
    if (domainParts.some(function (part) { return part.length > 63; }))
        return false;

    return true;
}

const isValidEmail2 = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

const isValidName = (name) => {
    const nameRegex = /^[\p{L}\s'-]+$/u;
    return nameRegex.test(name);
}

async function isUsernameTaken(username) {
    const query = 'SELECT COUNT(*) AS username_count FROM users WHERE LOWER(username) = LOWER($1)';
    const result = await db.query(query, [username]);
    return result.rows[0].username_count != 0;
}

async function isEmailTaken(email) {
    const query = 'SELECT COUNT(*) AS email_count FROM users WHERE LOWER(email) = LOWER($1)';
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
                return res.status(400).json(req.msg.json.EMPTY_DATA)

            const query = `SELECT id, username, password_hash, is_banned FROM users WHERE LOWER(${username ? 'username' : 'email'}) = LOWER($1);`;
            const result = await db.query(query, [username ? username : email]);
            
            const userData = result.rows[0];
            
            if (!userData) {
                return res.status(400).json(req.msg.json.WRONG_LOGIN_PASSWORD);
            }

            const isPasswordValid = await bcrypt.compare(password, userData.password_hash);

            if (!isPasswordValid)
                return res.status(400).json(req.msg.json.WRONG_LOGIN_PASSWORD);

            if (userData.is_banned)
                return res.status(403).send(req.msg.json.YOU_ARE_BANNED);

            const token = generateAccessToken(userData.id, userData.username);
            return res.status(200).json({ token });

        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }

    async signup(req, res) {
        try {
            const token = req.body.token?.trim();
            const decodedData = jwt.verify(token, process.env.REG_KEY_SECRET);

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
                return res.status(400).json(req.msg.json.USERNAME_TAKEN)
            }

            // is email taken

            if (await isEmailTaken(userData.email)) {
                return res.status(400).json(req.msg.json.EMAIL_TAKEN)
            }

            const hashPassword = bcrypt.hashSync(userData.password, 7);
            const newUser = await db.query('INSERT INTO users (username,fullname,email,password_hash) VALUES ($1,$2,$3,$4)',
                [userData.username, userData.fullname, userData.email, hashPassword]
            )

            res.status(200).json(newUser.rows[0]);
        } catch (e) {
            if (e instanceof jwt.JsonWebTokenError) {
                res.status(400).json(req.msg.json.INVALID_TOKEN);
            } else {
                console.log(e);
                res.status(500).json(req.msg.json.SERVER_ERROR);
            }
        }
    }

    async createRegToken(req, res) {
        try {
            const username = req.body?.username;
            if (!username || username.length < settings.USERNAME_MIN_LEN || username.length > settings.USERNAME_MAX_LEN) {
                return res.status(400).json(req.msg.json.INVALID_USERNAME);
            }

            // is username taken
            if (await isUsernameTaken(username))
                return res.status(400).json(req.msg.json.USERNAME_TAKEN)

            res.status(200).json({ token: generateRegAccessToken(username) })
        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }

    async getProfile(req, res) {
        try {
            const username = req.params?.username;
            if (!username || username.length > settings.USERNAME_MAX_LEN)
                return res.status(404).json(req.msg.json.INVALID_USERNAME);

            const query =
                'SELECT u.id, u.fullname, u.exp, u.lvl, u.rating, u.email, u.admin_lvl,\
                    COUNT(DISTINCT t.*)::INTEGER AS translations_count, COUNT(DISTINCT s.*)::INTEGER AS suggestions_count\
                    FROM users u LEFT JOIN translations t ON u.id = t.user_id\
                    LEFT JOIN suggestions s ON u.id = s.user_id\
                    WHERE u.username = $1\
                    GROUP BY u.id, u.fullname, u.exp, u.rating, u.email, u.admin_lvl LIMIT 1';

            const result = await db.query(query, [username]);
            const row = result.rows[0];
            
            if (!row)
                return res.status(404).json(req.msg.json.NOT_FOUND)

            const profile = {
                id: row.id,
                username,
                fullname: row.fullname,
                email: row.email,
                exp: row.exp,
                next_lvl_exp: utils.calcExpForLevel(row.lvl),
                lvl: row.lvl,
                rating: utils.roundNum(row.rating, 10),
                translations_count: row.translations_count,
                suggestions_count: row.suggestions_count
            };

            if (row.admin_lvl > 0)
                profile.admin_lvl = row.admin_lvl;

            if (req.user.id == profile.id)
                profile.is_self = true;

            return res.status(200).json(profile)
        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }

    async getUserTranslations(req, res) {
        try {
            let page = parseInt(req.query.page);
            if (isNaN(page) || page < 1)
                page = 1;

            const query1 =
                'SELECT\
                    texts.id AS text_id,\
                    texts.text AS original_text,\
                    translations.id as translation_id,\
                    translations.text,\
                    translations.rating,\
                    translations.rates_count\
                FROM texts\
                LEFT JOIN translations ON texts.id = translations.text_id\
                WHERE translations.user_id = $1 ORDER BY translation_id\
                LIMIT $2 OFFSET $3'

            const trnsResult = await db.query(query1,
                [req.params.id_by_username, settings.USER_STATS_TR_PER_PAGE, (page - 1) * settings.USER_STATS_TR_PER_PAGE]);

            const translations = trnsResult.rows;

            const groupedTranslations = translations.reduce((acc, tr) => {
                if (!acc.has(tr.text_id)) {
                    acc.set(tr.text_id, {
                        id: tr.text_id,
                        original_text: tr.original_text,
                        translations: [],
                    });
                }

                const translatedText = {
                    id: tr.id,
                    text: tr.text,
                };

                if (tr.rating != 0 && tr.rates_count != 0) {
                    translatedText.rating = utils.roundNum(tr.rating);
                    translatedText.rates_count = tr.rates_count;
                }

                acc.get(tr.text_id).translations.push(translatedText);
                return acc;
            }, new Map());

            const resultArray = Array.from(groupedTranslations.values()); // Convert Map values to an array

            res.status(200).json(resultArray)
        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }
}

module.exports = new UserController();