const db = require('../db');
const settings = require('../settings');

const utils = require('../utils');

const TASK_TYPE_TRANSLATE_RATE_SUGGEST = 'translate_rate_suggest';
const TASK_TYPE_SELECT_TRANSLATION = 'select_translation';

const TABLE_NAME_TRANSLATIONS = 'translations';
const TABLE_NAME_SUGGESTIONS = 'suggestions';

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

async function getTranslateTask(user_id, text_id = -1, isNewTextRequired = false) {
    let textQuery;
    let queryParams = [];

    if (text_id == -1) {
        textQuery = Math.random() < 0.7 ?
            'SELECT * FROM texts WHERE id NOT IN (SELECT text_id FROM translations) ORDER BY RANDOM() LIMIT 1'
            : `SELECT t.*\
            FROM texts t\
            LEFT JOIN translations tr ON t.id = tr.text_id\
            GROUP BY t.id\
            ${isNewTextRequired ? 'HAVING COUNT(tr.text_id) = 0' : ''}\
            ORDER BY RANDOM()\
            LIMIT 1`;
    } else {
        textQuery = 'SELECT * FROM texts WHERE id = $1';
        queryParams[0] = text_id;
    }

    const textResult = await db.query(textQuery, queryParams);

    if (!textResult.rowCount) return null;

    const taskId = textResult.rows[0].id;
    const translationsQuery = 'SELECT t.id, t.text, t.user_id, \
        u.username, t.is_dialect, t.rating, t.rates_count \
        FROM translations t \
        LEFT JOIN users u ON t.user_id = u.id \
        WHERE t.text_id = $1 ORDER BY t.id';
    const translationsResult = await db.query(translationsQuery, [taskId]);

    const task = {
        type: TASK_TYPE_TRANSLATE_RATE_SUGGEST,
        original_text: textResult.rows[0].text,
        id: taskId,
        translations: []
    };

    const existingSuggestionsIds = await getUserExistingSuggestionsIds(user_id);

    translationsResult.rows.forEach((row) => {
        const translation = {
            id: row.id,
            text: row.text,
            translator_username: row.username,
            rating: utils.roundNum(row.rating, 10),
            rates_count: row.rates_count,
            can_suggest: row.user_id !== user_id && !existingSuggestionsIds.includes(row.id),
            can_rate: row.user_id !== user_id &&
                (row.rating < settings.MIN_CORRECT_TR_RATING || row.rates_count < settings.MIN_CORRECT_TR_RATES_COUNT)
        };

        if (row.is_dialect) translation.is_dialect = true;

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
            rating: utils.roundNum(row.rating, 10),
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
        if (translations.length == 0) return true;
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
        res.status(500).json(req.msg.json.SERVER_ERROR);
        console.log(e);
    }
    return false;
}

async function makeRateTranslationQuery(tableName, id, mark, preventDelete) {
    const result = await db.query(getRateQuery(tableName), [mark, id]);
    const row = result.rows[0];
    const user_id = row.user_id

    if (row.rating > settings.MIN_INCORRECT_TR_RATING || row.rates_count < settings.MIN_INCORRECT_TR_RATES_COUNT)
        return -1;

    if (preventDelete) return user_id;

    const query = `DELETE FROM ${tableName} WHERE id=$1 RETURNING user_id`;
    db.query(query, [id]);
    return user_id;
}

async function commitRateAndSuggest(res, user_id, translations) {
    if (translations.length == 0) return true;
    const rateQuery = getRateQuery(TABLE_NAME_TRANSLATIONS);

    const sgAddQuesry =
        'INSERT INTO suggestions (text,user_id,translation_id) VALUES ($1,$2,$3)'

    for (const tr of translations) {
        const id = tr.id;

        const result = await db.query(rateQuery, [tr.mark, id]);
        const row = result.rows[0];
        const translatorUserId = await makeRateTranslationQuery(TABLE_NAME_TRANSLATIONS, id, mark)

        const isTranslationDeleted = translatorUserId != -1;

        if (!isTranslationDeleted && tr.suggestion)
            db.query(sgAddQuesry, [tr.suggestion, user_id, id])
    }
}

async function commitTranslationSelection(req, res, translation_id, suggestion_id, selection, trOriginal, trSuggestion) {
    const selectedNone = selection == -1;
    const trMark = selectedNone ? 1 : (selection ? settings.MIN_RATE_MARK : settings.MAX_RATE_MARK);
    const sgMark = selectedNone ? 1 : (selection ? settings.MAX_RATE_MARK : settings.MIN_RATE_MARK);

    const sgUserId = await makeRateTranslationQuery(TABLE_NAME_SUGGESTIONS, suggestion_id, sgMark)
    const isSuggestionDeleted = sgUserId != -1;

    if (isSuggestionDeleted) {
        // penalty for user[id = sgUserId]
    }

    const preventDelete = !isSuggestionDeleted;
    const trUserId = await makeRateTranslationQuery(TABLE_NAME_TRANSLATIONS, translation_id, trMark, preventDelete);
    const translationHasLowRating = trUserId != -1;
    const isTranslationDeleted = translationHasLowRating && !preventDelete;

    if (isTranslationDeleted && !isSuggestionDeleted) {
        // penalty for user[id = trUserId]
    // }else if (!isSuggestionDeleted) {
        // const updateResult = 
        console.log( [trSuggestion, sgUserId, translation_id]);
        await db.query(`UPDATE ${TABLE_NAME_TRANSLATIONS} SET text=$1, user_id=$2, rating=0, rates_count=0 WHERE id=$3`, [trSuggestion.text, trUserId, translation_id]);
    }
}

const calcExpRewardForTask = (user_id, task_type, tr_sg_count, text) => {
    let reward = 0;
    switch (task_type) {
        case TASK_TYPE_TRANSLATE_RATE_SUGGEST:
            reward = 3;
            break;

        case TASK_TYPE_SELECT_TRANSLATION:
            reward = 1;
            break;
    }
    return reward
}

async function onUserCompleteTask(res, user_id, task_type, tr_sg_count, text) {
    const rewardExp = calcExpRewardForTask(user_id, task_type, tr_sg_count, text)
    const saveTaskQuery = 'UPDATE users SET current_task_info=null, exp = exp + $1 WHERE id=$2 RETURNING exp, lvl';
    const result = await db.query(saveTaskQuery, [rewardExp, user_id]);

    let lvl_info = {
        reward: {
            count: rewardExp,
            item: 'exp'
        }
    };

    if (result.rowCount) {
        const { exp, lvl } = result.rows[0];
        lvl_info.exp = exp;
        lvl_info.lvl = lvl;

        const expToLvlUp = utils.calcExpForLevel(lvl);
        if (exp >= expToLvlUp) {
            const lvlUp = ~~(exp / expToLvlUp);
            const newLvl = lvl + lvlUp;
            const expRemainder = exp - expToLvlUp;

            lvl_info.old_lvl = lvl;
            lvl_info.lvl = newLvl;
            lvl_info.old_exp = exp;
            lvl_info.exp = expRemainder;
            lvl_info.next_lvl_exp = utils.calcExpForLevel(newLvl)

            const updateLevelQuery = 'UPDATE users SET lvl = $1, exp = $2 WHERE id = $3';
            await db.query(updateLevelQuery, [newLvl, expRemainder, user_id]);
        }
    }

    return res.status(200).json({ level_info: lvl_info });
}

const getRateQuery = (tableName) =>
    `UPDATE ${tableName} SET rating=((rating*rates_count+$1)/(rates_count+1)), rates_count=(rates_count+1) WHERE id=$2 RETURNING user_id, rating, rates_count`

const isTranslationsRequiredForTaskType = (task_type) => task_type == TASK_TYPE_TRANSLATE_RATE_SUGGEST;

const checkTranslationsBody = (req, res, translations, task_type) => {
    if (!Array.isArray(translations))
        return res.status(400).json(req.msg.json.INVALID_TRANSLATIONS_BODY);

    const map = [];
    for (const tr of translations) {
        const id = tr.id;
        if (id != undefined && id >= 0 && map[id] == true)
            return res.status(400).json(req.msg.json.DUPLICATE_TRANSLATION_IDS);

        map[id] = true;

        if (
            typeof tr.text != 'string' ||

            (id != undefined && (typeof id != 'number' || id < 0)) ||

            (tr.is_dialect != undefined && typeof tr.is_dialect != 'boolean') ||

            (tr.suggestion && typeof tr.suggestion != 'string') ||

            tr.mark != undefined &&

            (typeof tr.mark != 'number' ||

                tr.mark < settings.MIN_RATE_MARK ||

                tr.mark > settings.MAX_RATE_MARK)
        ) {
            return res.status(400).json(req.msg.json.INVALID_TRANSLATIONS_BODY);
        }
    }
    return false;
}

const splitTranslationsBodyByTaskType = (username, translations, originalTranslations) => {
    const translationsNew = [];
    const translationsRateSuggest = [];

    console.log('originalTranslations', originalTranslations);

    for (const tr of translations) {
        const origTr = originalTranslations.find(tr2 => tr.id == tr2.id);

        if (!origTr || origTr.translator_username == username)
            translationsNew.push(tr);
        else if (origTr && (tr.mark || tr.suggestion) && origTr.translator_username != username)
            translationsRateSuggest.push(tr);
    }

    return [translationsNew, translationsRateSuggest]
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
                                case TASK_TYPE_TRANSLATE_RATE_SUGGEST:
                                    task = await getTranslateTask(user_id, userTaskInfo.text_id);
                                    break;

                                case TASK_TYPE_SELECT_TRANSLATION:
                                    task = await getSelectTranslationTask(user_id, userTaskInfo.text_id);
                                    break;

                            }
                            task.isRestored = true;
                            return res.status(200).json(task);
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
            }

            const taskTypes = [TASK_TYPE_TRANSLATE_RATE_SUGGEST, TASK_TYPE_SELECT_TRANSLATION];
            const taskTypesCount = taskTypes.length;

            const getRandTaskType = () => {
                if (!taskTypes.length) return null;
                const index = //(taskTypes.length == taskTypesCount && Math.random() > 0.6) ? 0 : 
                    ~~(Math.random() * taskTypes.length);
                let task_type = taskTypes[index];
                taskTypes.splice(index, 1);
                return task_type;
            }

            let task_type;
            for (let i = 0; i < taskTypesCount; i++) {
                task_type = getRandTaskType();
                switch (task_type) {
                    case TASK_TYPE_TRANSLATE_RATE_SUGGEST:
                        task = await getTranslateTask(user_id, -1, req.query.newtext == 1);
                        break;

                    case TASK_TYPE_SELECT_TRANSLATION:
                        task = await getSelectTranslationTask(user_id);
                        break;
                }

                if (task) break;
            }

            if (!task)
                return res.status(404).json(req.msg.json.NO_TASKS_AVAILABLE);

            if (isLastTaskExpired)
                task.lastTaskExpired = isLastTaskExpired;

            const userTaskInfo = {
                task_type: task_type,
                text_id: task.id,
                expireDate: Date.now(),
            };

            const userTaskInfoStr = JSON.stringify(userTaskInfo);
            const saveTaskQuery = 'UPDATE users SET current_task_info=$1 WHERE id=$2';
            await db.query(saveTaskQuery, [userTaskInfoStr, user_id]);
            res.status(200).json(task);
        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }

    async submitTask(req, res) {
        try {
            const user_id = req.user.id;
            let userTaskInfo;
            let task;

            try {
                userTaskInfo = JSON.parse(await getUserTaskInfo(user_id));
            } catch (e) {
                console.log(e);
                return res.status(400).json(req.msg.json.YOU_HAVE_NO_TASK_YET);
            }

            if (!userTaskInfo)
                return res.status(400).json(req.msg.json.YOU_HAVE_NO_TASK_YET);

            const text_id = req.body.id;

            if (userTaskInfo.text_id != text_id)
                return res.status(400).json(req.msg.json.WRONG_ID);

            if (userTaskInfo.task_type != undefined && userTaskInfo.task_type != req.body.type)
                return res.status(400).json(req.msg.json.WRONG_TASK_TYPE);

            const isTranslationsRequired = isTranslationsRequiredForTaskType(userTaskInfo.task_type);

            const translations = req.body.translations;
            if (isTranslationsRequired && (!Array.isArray(translations) || translations.length == 0))
                return res.status(400).json(req.msg.json.NO_TRANSLATIONS_PROVIDED);


            if (isTranslationsRequired && translations.length > settings.MAX_TEXT_TRANSLATIONS)
                return res.status(400).json(req.msg.json.TOO_MANY_TRANSLATIONS_PROVIDED);

            if (isTranslationsRequired && checkTranslationsBody(req, res, translations, userTaskInfo.task_type))
                return;

            let commitResult = null;

            if (userTaskInfo.task_type == TASK_TYPE_TRANSLATE_RATE_SUGGEST) {
                task = await getTranslateTask(user_id, text_id);
                if (!task)
                    return res.status(404).json(req.msg.json.INVALID_TASK);

                let deletedTranslationsIds = [];
                const current_translations = task.translations ?? [];

                const currentTranslationsIds = current_translations.map(tr => tr.id);
                const new_translations_ids = translations.map(tr => tr.id);

                if (current_translations.length != 0) {
                    // сохранение айди переводов, которые на данный момент есть для этого текста,
                    // но в запросе их не было (пользователь удалил)
                    deletedTranslationsIds = task.translations
                        .map(tr => tr.id)
                        .filter(id => id != undefined && id >= 0 && !new_translations_ids.includes(id))
                }

                for (const tr of translations) {
                    if (tr.id == undefined || tr.id < 0) {
                        if (tr.mark != undefined || tr.suggestion != undefined)
                            return res.status(404).json(req.msg.json.NO_TRANSLATION_ID_FOR_RATE);

                        if (tr.suggestion != undefined)
                            return res.status(404).json(req.msg.json.NO_TRANSLATION_ID_FOR_SUGGESTION);

                        continue;
                    }

                    if (!currentTranslationsIds.includes(tr.id))
                        return res.status(404).json(req.msg.json.NO_TRANSLATION_WITH_ID_FOUND(tr.id));

                    const origTr = task.translations.find(tr2 => tr2.id == tr.id);

                    if (!origTr.can_suggest && tr.suggestion != undefined)
                        return res.status(403).json(req.msg.json.YOU_CANNOT_SUGGEST_TRANSLATION_WITH_ID(tr.id));

                    if (!origTr.can_rate && tr.mark != undefined)
                        return res.status(403).json(req.msg.json.YOU_CANNOT_RATE_TRANSLATION_WITH_ID(tr.id));
                }


                const trnsArr = splitTranslationsBodyByTaskType(req.user.username, translations, task.translations);

                commitTranslation(res, text_id, user_id, trnsArr[0], deletedTranslationsIds);
                commitRateAndSuggest(res, user_id, trnsArr[1]);

            } else if (userTaskInfo.task_type == TASK_TYPE_SELECT_TRANSLATION) {
                task = await getSelectTranslationTask(user_id, text_id);

                if (!task)
                    return res.status(404).json(req.msg.json.INVALID_TASK);

                const selection = req.body.selection;
                if (typeof selection != 'number' || (selection < -1 || selection > 1))
                    return res.status(404).json(req.msg.json.INVALID_SELECTION);

                commitTranslationSelection(req, res, task.original.id, task.suggestion.id, selection, task.original, task.suggestion);
            } else {
                return res.status(500).json(req.msg.json.INVALID_TASK);
            }

            onUserCompleteTask(res, user_id, userTaskInfo.task_type, task?.original_text)
        } catch (e) {
            console.log(e);
            res.status(500).json(req.msg.json.SERVER_ERROR);
        }
    }
}

module.exports = new TaskController()