import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom';
import api from '../api'

export default function ProfilePage({match}) {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);

    async function getProfile() {
        try {
            const res = await api.get(`/user/${username}`);
            localStorage.setItem('username', res.data.username.trim())
            setProfile(res.data)
        } catch (e) {
            console.log(e);
        }


    }

    useEffect(() => {
        getProfile();
    }, []);

    if (!profile) return <div><p>Загрузка...</p></div>

    return (
        <div>
            {/* <p>{JSON.stringify(profile, 0, 4)}</p> */}
            <h5>@{profile.username}</h5>
            <h6>{profile.fullname}</h6>
            <p>Email: {profile.email}</p>
            <p>Опыт: {profile.exp} / {profile.next_lvl_exp}</p>
            <p>Уровень: {profile.lvl}</p>
            <p>Рейтинг: {profile.rating ? profile.rating : 'Нет'}</p>
            <p>Перевёл текстов: {profile.translations_count}</p>
            <p>Предложил переводов: {profile.suggestions_count}</p>
            <Link to={`/user/${username}/translations/`}>Переводы</Link>
        </div>
    )
}
