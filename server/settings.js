const settings = {
    DEF_LANG:               'en',
    PASSWORD_EXPIRES_IN:    '14 days',
    REG_TOKEN_EXPIRES_IN:   '10m',
    TASK_EXPIRES_IN:        10 * 60 * 1000,

    USERNAME_MIN_LEN:       3,
    USERNAME_MAX_LEN:       32,
    NAME_MIN_LEN:           3,
    NAME_MAX_LEN:           32,
    PASSWORD_MIN_LEN:       8,
    PASSWORD_MAX_LEN:       16,

    MAX_TEXT_TRANSLATIONS:  8,
    MIN_RATE_MARK:          1,
    MAX_RATE_MARK:          5,

    EXP_PER_LVL_COEF:       8,
    USER_STATS_TR_PER_PAGE: 20,

    MIN_CORRECT_TR_RATING:  4.1,
    MIN_INCORRECT_TR_RATING:  2.0,
    MIN_CORRECT_TR_RATES_COUNT: 5,
    MIN_INCORRECT_TR_RATES_COUNT: 5
};

module.exports = settings;