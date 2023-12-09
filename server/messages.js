const messages = {
    NOT_FOUND: 'Not found',
    USER_NOT_FOUND: 'User is not found',
    SERVER_ERROR: 'Server error',
    AUTH_REQUIRED: 'Authorization required',
    YOU_ARE_BANNED: 'You are banned',
    INVALID_USERNAME: 'Invalid username',
    EMPTY_DATA: 'Empty data',
    WRONG_LOGIN_PASSWORD: 'Wrong login or password',
    USERNAME_TAKEN: 'Username taken',
    EMAIL_TAKEN: 'Email taken',
    INVALID_TOKEN: 'Invalid token',
    INVALID_TRANSLATIONS_BODY: 'Invalid translations body',
    DUPLICATE_TRANSLATION_IDS: 'Duplicate translation ids',
    NO_TASKS_AVAILABLE: 'No tasks available',
    YOU_HAVE_NO_TASK_YET: 'You have no task yet 1',
    WRONG_ID: 'Wrong id',
    WRONG_TASK_TYPE: 'Wrong task type',
    NO_TRANSLATIONS_PROVIDED: 'No translations provided',
    TOO_MANY_TRANSLATIONS_PROVIDED: 'Too many translations provided',
    INVALID_TASK: 'Invalid task',
    NO_TRANSLATION_WITH_ID_FOUND: id => `No translation with id = ${id} found`,
    CANNOT_SUGGEST_TRANSLATION: id => `You can't suggest translation for id = ${id}`,
    INVALID_SELECTION: 'Invalid selection',
    NO_TRANSLATION_ID_FOR_RATE: 'Translation ID for rate is not specified',
    NO_TRANSLATION_ID_FOR_SUGGESTION: 'Translation ID for suggestion is not specified',
    YOU_CANNOT_DELETE_TRANSLATION_WITH_ID: id => `You cannot delete a translation with id=${id} that is not yours`,
    YOU_CANNOT_SUGGEST_TRANSLATION_WITH_ID: id => `You cannot suggest a translation with id=${id} that is not yours`,
    YOU_CANNOT_RATE_TRANSLATION_WITH_ID: id => `You cannot rate a translation with id=${id} that is not yours`
};

const json = (() => {
    const obj = {};
    for (const key of Object.keys(messages)) {
        if (typeof messages[key] == 'function') {
            obj[key] = (...args) => {
                return { msg: messages[key](...args)}
            }
        }else obj[key] = { msg: messages[key] };
    }
    return obj;
})();

messages.json = json;

module.exports = messages;