import React, { useState, useEffect, useRef } from 'react'
import api from '../api'
import RateTranslation from '../components/RateTranslation';
import Translation from '../components/Translation';

export default function Task() {
    const NO_SELECTION = -2;

    const [task, setTask] = useState(null);
    const [err, setErr] = useState(null);
    const [translations, setTranslations] = useState([])
    const [buttonDisabled, setButtonDisabled] = useState(true);
    const [selection, setSelection] = useState(NO_SELECTION);

    const MAX_TRANSLATIONS = 8;

    async function getTask(skip = 0) {
        try {
            const res = await api.get(`task?skip=${skip}`)
            // console.log(res);
            if (res?.statusText != 'OK') return alert(res?.data?.msg);
            if (res.data.translations?.length == 0)
                res.data.translations.push({ text: '' })

            setTask(res.data)
            console.log(res.data);
            // console.log('task', res.data);
            if (res.data.translations)
                setTranslations(res.data?.translations)
        } catch (e) {
            console.log(e);
        }
    }

    const select = (idx) => {
        const s = selection == idx ? NO_SELECTION : idx;
        setSelection(s);
    }

    const isMarkValid = (mark) => mark >= 1 && mark <= 5;

    const canSubmit = () => {
        return task?.type == TASK_TYPE_SELECT_TRANSLATION ? selection != NO_SELECTION : translations?.some(tr => {
            if (task.type == TASK_TYPE_RATE_AND_SUGGEST)
                return isMarkValid(tr.mark);

            if (task.type == TASK_TYPE_TRANSLATE)
                return tr.text?.trim().length != 0;
            return false
        })
    }

    const updateButtonState = () => {
        const canSubmitFlag = canSubmit();
        setButtonDisabled(!canSubmitFlag);
    };

    function submitTask(e) {
        e.preventDefault()
        const reqBody = {
            type: task.type,
            id: task.id,
        };

        if (task.type == TASK_TYPE_SELECT_TRANSLATION) {
            reqBody.selection = selection;
            setSelection(NO_SELECTION);
        } else {
            reqBody.translations = []

            for (const tr of translations) {
                const tr2 = {};
                const id = tr.id;
                if (id) tr2.id = id;

                if (task.type == TASK_TYPE_TRANSLATE) {
                    const text = tr.text?.trim();
                    if (!text || text.length == 0) continue
                    tr2.text = text;
                    if (tr.is_dialect)
                        tr2.is_dialect = true;
                } else if (task.type == TASK_TYPE_RATE_AND_SUGGEST) {
                    const suggestion = tr.suggestion?.trim();
                    const mark = tr.mark;
                    if (!isMarkValid(mark)) continue;
                    tr2.mark = mark;
                    if (suggestion && suggestion.length)
                        tr2.suggestion = suggestion;
                }
                reqBody.translations.push(tr2)
            }
        }

        console.log(JSON.stringify(reqBody, 0, 4));
        try {

            api
                .post('task', reqBody)
                .then(res => {
                    console.log(res);
                    getTask(1)
                }).catch(err => {
                    alert(`Ошибка. ${err.response.data.msg}`)
                })
                

        } catch (e) {
            console.log(e);
        }

    }

    const TASK_TYPE_TRANSLATE = 'translate';
    const TASK_TYPE_RATE_AND_SUGGEST = 'rate_and_suggest';
    const TASK_TYPE_SELECT_TRANSLATION = 'select_translation';

    useEffect(() => {
        getTask();
    }, []);

    useEffect(() => {
        updateButtonState();
    }, [translations]);

    if (!task)
        return (<div><p>Загрузка...</p></div>)

    const addTranslation = () => {
        if (task.type != TASK_TYPE_TRANSLATE || translations.length >= MAX_TRANSLATIONS) return;
        setTranslations([
            ...translations,
            { text: '' }
        ]);
    }

    const onRemove = (index) => {
        if (task.type != TASK_TYPE_TRANSLATE || translations.length < 2) return;
        const updatedTranslations = translations.filter((_, i) => i !== index);
        setTranslations(updatedTranslations);
    }

    const onRate = (index, mark) => {
        if (task.type != TASK_TYPE_RATE_AND_SUGGEST) return;
        const updatedTranslations = [...translations];
        updatedTranslations[index].mark = mark;
        setTranslations(updatedTranslations);
    }

    const onTextChange = (index, value) => {
        const tr = translations[index];
        if (!tr) return;
        tr.text = value;
        updateButtonState();
    }

    const onSuggestionChange = (index, value) => {
        const tr = translations[index];
        if (!tr) return;
        tr.suggestion = value;
        updateButtonState();
    }

    const onDialectChange = (index, value) => {
        const tr = translations[index];
        if (!tr) return;
        tr.is_dialect = value;
        console.log(tr.is_dialect);
    }



    const titleText = task.type == TASK_TYPE_TRANSLATE ? 'Переведите:' :
        task.type == TASK_TYPE_RATE_AND_SUGGEST ? 'Оцените перевод(ы), предложите свои:' :
            task.type == TASK_TYPE_SELECT_TRANSLATION ? 'Выберите правильный перевод: ' : '';

    const task_id = task.type == TASK_TYPE_SELECT_TRANSLATION ? task.text_id : task.id;
    return (
        <form onSubmit={submitTask}>
            
            <h2>{titleText}</h2>
            <h5>Текст #{task_id}</h5>
            <h5>{task.original_text}</h5>

            {task.type != TASK_TYPE_SELECT_TRANSLATION ? translations.map((tr, index) =>
                task.type == TASK_TYPE_RATE_AND_SUGGEST ?
                    <RateTranslation
                        key={index + task.id}
                        mark={tr.mark || 0}
                        textChangeCallback={onTextChange}
                        index={index}
                        isSingle={translations.length == 1}
                        translationItem={tr}
                        suggChangeCallback={onSuggestionChange}
                        rateCallback={onRate}
                        removeCallback={onRemove}
                        dialectCallback={onDialectChange}
                    /> :
                    task.type == TASK_TYPE_TRANSLATE ?
                        <Translation
                            key={index + task.id}
                            index={index}
                            textChangeCallback={onTextChange}
                            isSingle={translations.length == 1}
                            translationItem={tr}
                            removeCallback={onRemove}
                            dialectCallback={onDialectChange}
                        />
                        : <></>
            ) : <></>}

            {task.type == TASK_TYPE_TRANSLATE && translations.length < MAX_TRANSLATIONS ? 
                <button type='button' onClick={addTranslation}>Добавить перевод</button> : <></>}

            {task.type == TASK_TYPE_SELECT_TRANSLATION ? <div>
                <div className="translation_items noselect">
                    <div className={"translation_item " + (selection == 0 ? "selected" : "unselected")} onClick={() => select(0)}>
                        <h5>{task.original.text}</h5>
                        <p>Перевёл: {task.original.translator_username}</p>
                        <p>Рейтинг: {task.original.rating}</p>
                        <p>Оценок: {task.original.rates_count == 0 ? 'Нет' : task.original.rates_count}</p>
                    </div>
                    <div className={"translation_item " + (selection == 1 ? "selected" : "unselected")} onClick={() => select(1)}>
                        <h5>{task.suggestion.text}</h5>
                        <p>Перевёл: {task.suggestion.translator_username}</p>
                        <p>Рейтинг: {task.suggestion.rating}</p>
                        <p>Оценок: {task.suggestion.rates_count == 0 ? 'Нет' : task.suggestion.rates_count}</p>
                    </div>
                    <div className={"translation_item neither " + (selection == -1 ? "selected" : "unselected")} onClick={() => select(-1)}>
                        <h5>Ни один из предложенных</h5>
                    </div>
                </div>
            </div> : <></>}

            <div style={{
                display: 'flex',
                marginTop: '20px'
            }}>
                <button type='button' onClick={() => getTask(1)}>Пропустить</button>
                <input type='submit' disabled={!canSubmit()} value='Подтвердить'/>

            </div>
        </form>)
}
