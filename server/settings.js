const settings = {
    DEF_LANG:               'en',
    USERNAME_MIN_LEN:       3,
    USERNAME_MAX_LEN:       32,
    NAME_MIN_LEN:           3,
    NAME_MAX_LEN:           32,
    PASSWORD_MIN_LEN:       8,
    PASSWORD_MAX_LEN:       16,

    MAX_TEXT_TRANSLATIONS:  8,
    MIN_RATE_MARK:          1,
    MAX_RATE_MARK:          5,

    PASSWORD_EXPIRES_IN:    '14 days',
    REG_TOKEN_EXPIRES_IN:   '10m',
    TASK_EXPIRES_IN:        10 * 60 * 1000
};

module.exports = settings;