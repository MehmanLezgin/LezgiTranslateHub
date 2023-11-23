import React, { useState, useEffect } from 'react'
import Cookies from 'js-cookie';

import { Navigate, Route } from 'react-router-dom';
import AuthPage from './AuthPage';

export default function DashboardPage() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [startTask, setStartTask] = useState(false);

    // console.log('yes', token);
    // useEffect(() => {
    //     // localStorage.setItem('token', '1234')
    //     const t = localStorage.getItem('token')
    //     console.log('aaaaa',t);
    //     setToken(t);
    // }, [])

    // if (token != null) {
    //     console.log(token);
    if (!startTask) {
        return (
            <div>
                <p>Личный кабинет</p>

                <button onClick={() => { setStartTask(true) }}>Начать задание</button>
            </div >
        )
    }else {
        return <Navigate to={'/task'} />
    }
        // <button onClick={() => { localStorage.setItem('token', null); setToken(null); }}>Начать задание</button>
    // } else {
    //     console.log('noooo');
    //     // return <p>please auth</p>;
    //     return <Navigate to={'/auth'} />
    // }
}
