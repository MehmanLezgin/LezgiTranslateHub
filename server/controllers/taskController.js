const db = require('../db');
const settings = require('../settings');

const TASK_TYPE_TRANSLATE = 'translate';
const TASK_TYPE_RATE_AND_SUGGEST = 'rate_and_suggest';
const TASK_TYPE_SELECT_TRANSLATION = 'select_translation';

const SERVER_ERROR_MSG = { msg: 'Server Error' };

async function getUserTranslationsCount(user_id) {
    const query = 'SELECT COUNT(*) AS tr_count FROM translations WHERE user_id = $1'
    const result = await db.query(query, [user_id]);
    return result.rows[0].tr_count;
}

async function getUserExistingSuggestionsIds(user_id) {
    const sgQuery = 'SELECT translation_id FROM suggestions WHERE user_id=$1'
    const sgResult = await db.query(sgQuery, [user_id])
    const existingSuggestionsIds = sgResult.rows.map(row => row.translation_id);
    return existingSuggestionsIds;
}

async function getRateAndSuggestTask(user_id, text_id = -1) {
    const textQuery = text_id == -1 ?
        `SELECT id, text\
    FROM texts\
    WHERE EXISTS (\
        SELECT texts.id\
        FROM translations\
        WHERE translations.text_id = texts.id\
        AND translations.user_id != ${user_id}\
    ) ORDER BY RANDOM() LIMIT 1;` :
        `SELECT id, text FROM texts WHERE id=${text_id}`;

    const textResult = await db.query(textQuery);
    if (!textResult.rows.length) return null;
    if (text_id == -1) text_id = textResult.rows[0].id;

    const translationsQuery =
        'SELECT t.id, t.text, u.username, t.is_dialect, t.rating, t.rates_count\
    FROM translations t JOIN users u ON t.user_id = u.id\
    WHERE t.text_id = $1 ORDER BY t.id';
    const trnsResult = await db.query(translationsQuery, [text_id]);

    const task = {
        type: TASK_TYPE_RATE_AND_SUGGEST,
        original_text: textResult.rows[0].text,
        id: text_id,
        translations: []
    };

    const existingSuggestionsIds = await getUserExistingSuggestionsIds(user_id);

    for (let i = 0; i < trnsResult.rows.length; i++) {
        const row = trnsResult.rows[i];

        const tr = {
            id: row.id,
            text: row.text,
            translator_username: row.username,
            rating: roundNum(row.rating, 10),
            rates_count: row.rates_count,
            can_suggest: !existingSuggestionsIds.includes(row.id)
        };

        task.translations.push(tr);
    }
    return task;
}

async function getTranslateTask(text_id = -1) {
    let textQuery;
    let queryParams = [];

    if (text_id == -1) {
        textQuery = 'SELECT * FROM texts WHERE id NOT IN (SELECT text_id FROM translations) ORDER BY RANDOM() LIMIT 1';
    } else {
        textQuery = 'SELECT * FROM texts WHERE id = $1';
        queryParams[0] = text_id;
    }

    const textResult = await db.query(textQuery, queryParams);

    if (!textResult.rows.length) return null;

    const taskId = textResult.rows[0].id;
    const translationsQuery = 'SELECT id, text FROM translations WHERE text_id = $1 ORDER BY id';
    const translationsResult = await db.query(translationsQuery, [taskId]);

    const task = {
        type: TASK_TYPE_TRANSLATE,
        original_text: textResult.rows[0].text,
        id: taskId,
        translations: []
    };

    translationsResult.rows.forEach((row) => {
        const translation = {
            id: row.id,
            text: row.text
        };
        task.translations.push(translation);
    });
    return task;
}


async function getSelectTranslationTask(user_id, suggestion_id = -1) {
    let textQuery;
    let queryParams;

    if (suggestion_id == -1) {
        textQuery =
        'SELECT suggestions.*, users.username AS username\
        FROM suggestions\
        INNER JOIN users ON suggestions.user_id = users.id\
        INNER JOIN translations ON suggestions.translation_id = translations.id\
        WHERE suggestions.user_id != $1\
        AND translations.user_id != $1\
        ORDER BY RANDOM()\
        LIMIT 1'
            // 'SELECT suggestions.*, users.username AS username\
            // FROM suggestions\
            // INNER JOIN users ON suggestions.user_id = users.id\
            // WHERE suggestions.user_id != $1\
            // ORDER BY RANDOM()\
            // LIMIT 1';
        queryParams = [user_id];
    } else {
        textQuery =
            'SELECT suggestions.*, users.username AS username\
            FROM suggestions\
            INNER JOIN users ON suggestions.user_id = users.id\
            WHERE suggestions.user_id != $1 AND suggestions.id = $2\
            LIMIT 1';
        queryParams = [user_id, suggestion_id];
    }

    const sgResult = await db.query(textQuery, queryParams);

    const sgRow = sgResult?.rows[0];
    // console.log(sgRow);
    if (!sgRow) return null;
    if (suggestion_id == -1) suggestion_id = sgRow.id;

    const query2 =
        'SELECT translations.*, texts.text AS original_text, texts.id AS original_text_id, users.username AS username \
        FROM translations \
        LEFT JOIN texts ON translations.text_id = texts.id \
        LEFT JOIN users ON translations.user_id = users.id \
        WHERE translations.id = $1';


    const trResult = await db.query(query2, [sgRow.translation_id]);

    const trRow = trResult?.rows[0];
    if (!trRow) return null;

    const getTranslationData = (row) => {
        return {
            id: row.id,
            text: row.text,
            translator_username: row.username,
            is_dialect: row.is_dialect,
            rating: roundNum(row.rating, 10),
            rates_count: row.rates_count
        }
    };

    const task = {
        type: TASK_TYPE_SELECT_TRANSLATION,
        original_text: trRow.original_text,
        text_id: trRow.original_text_id,
        id: sgRow.id,
        original: getTranslationData(trRow),
        suggestion: getTranslationData(sgRow)
    };

    return task;
}

async function getUserTaskInfo(user_id) {
    const result = await db.query('SELECT current_task_info FROM users WHERE id=$1', [user_id]);
    const info = result.rows[0]?.current_task_info;
    return info;
}

async function commitTranslation(res, text_id, user_id, translations, deletedTranslationsIds) {
    try {
        // deleting
        for (const id of deletedTranslationsIds) {
            if (id == text_id) continue;
            const query = 'DELETE FROM translations WHERE id=$1';
            db.query(query, [id]);
        }
        const query1 =
            'INSERT INTO translations (text, user_id, is_dialect, text_id) values ($1,$2,$3,$4)'

        const query2 =
            'UPDATE translations SET text=$1, user_id=$2, is_dialect=$3 WHERE id=$4'

        for (const tr of translations) {
            const id = tr.id;
            if (id == undefined || id < 0)
                db.query(query1, [tr.text, user_id, tr.is_dialect ?? false, text_id]);
            else
                db.query(query2, [tr.text, user_id, tr.is_dialect ?? false, id]);
        }
        
        return true;
    } catch (e) {
        res.status(500).json(SERVER_ERROR_MSG);
        console.log(e);
    }
    return false;
}

async function commitRateAndSuggest(res, user_id, translations) {
    try {
        const rateQuery = getRateQuery('translations');

        const sgAddQuesry =
            'INSERT INTO suggestions (text,user_id,translation_id) VALUES ($1,$2,$3)'

        for (const tr of translations) {
            const id = tr.id;

            db.query(rateQuery, [tr.mark, id]);

            if (tr.suggestion)
                db.query(sgAddQuesry, [tr.suggestion, user_id, id])
        }
        
        return true;
    } catch (e) {
        res.status(500).json(SERVER_ERROR_MSG);
        console.log(e);
    }
    return false;
}

async function commitTranslationSelection(res, translation_id, suggestion_id, selection) {
    try {
        const trRateQuery = getRateQuery('translations');
        const sgRateQuery = getRateQuery('suggestions');

        const selectedNone = selection == -1;
        const trMark = selectedNone ? 1 : (selection ? settings.MIN_RATE_MARK : settings.MAX_RATE_MARK);
        const sgMark = selectedNone ? 1 : (selection ? settings.MAX_RATE_MARK : settings.MIN_RATE_MARK);

        db.query(trRateQuery, [trMark, translation_id]);
        db.query(sgRateQuery, [sgMark, suggestion_id]);

        return true;
    } catch (e) {
        res.status(500).json(SERVER_ERROR_MSG);
        console.log(e);
    }
    return false;
}

async function onUserCompleteTask(res, user_id, task_type) {
    try {
        const saveTaskQuery = 'UPDATE users SET current_task_info=null WHERE id=$1';
        await db.query(saveTaskQuery, [user_id]);
        return res.status(200).end();
    }catch(e) {
        return res.status(500).json(SERVER_ERROR_MSG);
    }
}

const roundNum = (num, d = 10) => Math.round(num * d) / d;

const getRateQuery = (tableName) =>
    `UPDATE ${tableName} SET rating=((rating*rates_count+$1)/(rates_count+1)), rates_count=(rates_count+1) WHERE id=$2`

const isTranslationsRequiredForTaskType = (task_type) =>
    [TASK_TYPE_TRANSLATE, TASK_TYPE_RATE_AND_SUGGEST].includes(task_type);

const checkTranslationsBody = (translations, res, task_type) => {
    if (!Array.isArray(translations))
        return res.status(400).json({ msg: 'Invalid translations body' });

    const map = [];
    for (const tr of translations) {
        const id = tr.id;
        if (id != undefined && id >= 0 && map[id] == true)
            return res.status(400).json({ msg: 'Duplicate translation ids' });

        map[id] = true;

        if (task_type == TASK_TYPE_TRANSLATE) {
            if (typeof tr.text != 'string' || (id != undefined && typeof id != 'number' && id >= 0)
                || (tr.is_dialect != undefined && typeof tr.is_dialect != 'number' && typeof tr.is_dialect != 'boolean')
            ) {
                return res.status(400).json({ msg: 'Invalid translations body' });
            }
        } else if (task_type == TASK_TYPE_RATE_AND_SUGGEST) {
            if ((tr.suggestion && typeof tr.suggestion != 'string') || (typeof id != 'number' && id >= 0) ||
                tr.mark == undefined || typeof tr.mark != 'number' ||
                tr.mark < settings.MIN_RATE_MARK || tr.mark > settings.MAX_RATE_MARK
            ) {
                return res.status(400).json({ msg: 'Invalid translations body' });
            }
        }
    }
    return false;
}

class TaskController {
    async getTask(req, res) {
        try {
            const skip = req.query.skip == true;
            const user_id = req.user.id;
            let isLastTaskExpired = false;
            let task = null;

            if (!skip) {
                try {
                    const userTaskInfoStr = await getUserTaskInfo(user_id)
                    const userTaskInfo = JSON.parse(userTaskInfoStr);

                    if (userTaskInfo) {
                        if (Date.now() - userTaskInfo.expireDate > settings.TASK_EXPIRES_IN) {
                            isLastTaskExpired = true;
                        } else {
                            switch (userTaskInfo.task_type) {
                                case TASK_TYPE_TRANSLATE:
                                    task = await getTranslateTask(userTaskInfo.text_id);
                                    break;

                                case TASK_TYPE_RATE_AND_SUGGEST:
                                    task = await getRateAndSuggestTask(user_id, userTaskInfo.text_id);
                                    break;

                                case TASK_TYPE_SELECT_TRANSLATION:
                                    task = await getSelectTranslationTask(user_id, userTaskInfo.text_id);
                                    break;

                            }
                            task.isRestored = true;
                            // console.log(userTaskInfo);

                            return res.status(200).json(task);
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
            }

            const taskTypes = [TASK_TYPE_TRANSLATE, TASK_TYPE_RATE_AND_SUGGEST, TASK_TYPE_SELECT_TRANSLATION];
            const taskTypesCount = taskTypes.length;

            const getRandTaskType = () => {
                if (!taskTypes.length) return null;
                const index = (taskTypes.length == taskTypesCount && Math.random() > 0.99) ? 0 : ~~(Math.random() * taskTypes.length);
                let task_type = taskTypes[index];
                taskTypes.splice(index, 1);
                return task_type;
            }

            let task_type;
            for (let i = 0; i < taskTypesCount; i++) {
                task_type = getRandTaskType();
                switch (task_type) {
                    case TASK_TYPE_TRANSLATE:
                        task = await getTranslateTask();
                        break;

                    case TASK_TYPE_RATE_AND_SUGGEST:
                        task = await getRateAndSuggestTask(user_id);
                        break;

                    case TASK_TYPE_SELECT_TRANSLATION:
                        task = await getSelectTranslationTask(user_id);
                        break;
                }

                if (task) break;
            }

            if (!task)
                return res.status(404).json({ msg: 'No tasks available' });

            if (isLastTaskExpired)
                task.lastTaskExpired = isLastTaskExpired;

            const userTaskInfo = {
                task_type: task_type,
                text_id: /*task_type == TASK_TYPE_SELECT_TRANSLATION ? task.suggestion.id : */task.id,
                expireDate: Date.now(),
            };

            const userTaskInfoStr = JSON.stringify(userTaskInfo);
            const saveTaskQuery = 'UPDATE users SET current_task_info=$1 WHERE id=$2';
            await db.query(saveTaskQuery, [userTaskInfoStr, user_id]);
            
            console.log(userTaskInfo);
            res.status(200).json(task);
        } catch (e) {
            console.log(e);
            res.status(500).json(SERVER_ERROR_MSG);
        }
    }

    async submitTask(req, res) {
        try {
            const user_id = req.user.id;
            let userTaskInfo;

            try {
                userTaskInfo = JSON.parse(await getUserTaskInfo(user_id));
            } catch (e) {
                console.log(e);
                return res.status(400).json({ msg: 'You have no task yet 1' });
            }

            if (!userTaskInfo)
                return res.status(400).json({ msg: 'You have no task yet 2' });

            const text_id = req.body.id;
            // console.log(text_id, userTaskInfo.text_id);

            // console.log(userTaskInfo);
            if (userTaskInfo.text_id != text_id)
                return res.status(400).json({ msg: 'Wrong id' });

            if (userTaskInfo.task_type != undefined && userTaskInfo.task_type != req.body.type)
                return res.status(400).json({ msg: 'Wrong task type' });

            const isTranslationsRequired = isTranslationsRequiredForTaskType(userTaskInfo.task_type);

            const translations = req.body.translations;
            if (isTranslationsRequired && (!Array.isArray(translations) || translations.length == 0))
                return res.status(400).json({ msg: 'No translations provided' });


            if (isTranslationsRequired && translations.length > settings.MAX_TEXT_TRANSLATIONS)
                return res.status(400).json({ msg: 'Too many translations provided' });

            if (isTranslationsRequired && checkTranslationsBody(translations, res, userTaskInfo.task_type))
                return;

            let commitResult = null;

            if (userTaskInfo.task_type == TASK_TYPE_TRANSLATE) {
                const task = await getTranslateTask(text_id);
                if (!task)
                    return res.status(404).json({ msg: 'Invalid task' });

                let deletedTranslationsIds = [];
                const current_translations = task.translations ?? [];

                const current_translations_ids = current_translations.map(tr => tr.id);
                const new_translations_ids = translations.map(tr => tr.id);

                if (current_translations.length != 0) {
                    // сохранение айди переводов, которые на данный момент есть для этого текста,
                    // но в запросе их не было (пользователь удалил)
                    deletedTranslationsIds = task.translations
                        .map(tr => tr.id)
                        .filter(id => id != undefined && id >= 0 && !new_translations_ids.includes(id))
                }

                for (const tr of translations) {
                    if (tr.id == undefined || tr.id < 0) continue;
                    if (!current_translations_ids.includes(tr.id))
                        return res.status(404).json({ msg: `No translation with id = ${tr.id} found` });
                }

                commitResult = commitTranslation(res, text_id, user_id, translations, deletedTranslationsIds);

            } else if (userTaskInfo.task_type == TASK_TYPE_RATE_AND_SUGGEST) {
                const task = await getRateAndSuggestTask(user_id, text_id);
                if (!task)
                    return res.status(404).json({ msg: 'Invalid task' });

                for (const tr of translations) {
                    if (!task.translations.some(tr2 => tr.id == tr2.id))
                        return res.status(404).json({ msg: `No translation with id = ${tr.id} found` });

                    if (task.translations.some(tr2 => tr2.id == tr.id && tr.suggestion && !tr2.can_suggest))
                        return res.status(404).json({ msg: `You can't suggest translation for id = ${tr.id}` });
                }

                commitResult = commitRateAndSuggest(res, user_id, translations);

            } else if (userTaskInfo.task_type == TASK_TYPE_SELECT_TRANSLATION) {
                const task = await getSelectTranslationTask(user_id, text_id);

                if (!task)
                    return res.status(404).json({ msg: 'Invalid task' });

                const selection = req.body.selection;
                if (typeof selection != 'number' || (selection < -1 || selection > 1))
                    return res.status(404).json({ msg: 'Invalid selection' });

                commitResult = commitTranslationSelection(res, task.original.id, task.suggestion.id, selection);
            } else {
                return res.status(500).json({ msg: 'Invalid task' });
            }

            if (commitResult) {
                onUserCompleteTask(res, user_id, userTaskInfo.task_type)
            }
        } catch (e) {
            console.log(e);
            res.status(500).json(SERVER_ERROR_MSG);
        }
    }
}

module.exports = new TaskController()