import React, { useEffect, useState } from 'react'
import api from '../api'
import { useParams } from 'react-router-dom';
import './style.css'
import Username from '../components/Username';

export default function UserTranslationsPage() {
    const username = localStorage.getItem('username') || 'self';
    const [translations, setTranslations] = useState(null);
    const [page, setPage] = useState(1);

    async function loadPage() {
        let res = await api.get(`user/${username}/translations?page=${page}`);
        setTranslations(res.data)
    }

    useEffect(() => {
        loadPage();
        if (translations) console.log(translations[0]);
    }, [page])

    const btns = <div>
        <button onClick={() => setPage(Math.max(1, page - 1))}>Назад</button>
        Страница {page}
        <button onClick={() => setPage(Math.min(99, page + 1))}>Далее</button>
    </div>
    return translations ? (
        <div>
            {btns}
            <table>
                <thead>
                    <tr>
                        <th colSpan={5}>Translations of <Username username={username} /></th>
                    </tr>
                    <tr>
                        <th>№</th>
                        <th>Тест</th>
                        <th>Перевод</th>
                        <th>Рейтинг</th>
                        <th>Оценок</th>
                    </tr>
                </thead>
                <tbody>
                    {translations.map((item, index) => (
                        <React.Fragment key={item.id}>
                            <tr>
                                <td rowSpan={item.translations.length || 1}>{(page - 1) * 20 + index + 1}</td>
                                <td rowSpan={item.translations.length || 1}>{item.original_text}</td>
                                {/* {item.translations.length > 0 ? ( */}
                                <td>{item.translations[0].text}</td>
                                <td>{item.translations[0].rating ?? 'Нет'}</td>
                                <td>{item.translations[0].rates_count ?? 'Нет'}</td>
                            </tr>

                            {item.translations.slice(1).map((translation, idx) => (
                                <tr key={translation.id}>
                                    <td>{translation.text}</td>
                                    <td>{translation.rating ?? 'Нет'}</td>
                                    <td>{translation.rates_count ?? 'Нет'}</td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            {btns}
        </div>
    ) : (
        <div>
            <p>Загрузка...</p>
        </div>
    );


}
