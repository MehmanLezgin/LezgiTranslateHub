import React from 'react'

import { Link, Navigate, useParams } from 'react-router-dom';
import AuthPage from './AuthPage';

export default function DashboardPage() {
    return (
        <div>
            <p>Личный кабинет</p>

            <Link to={`/user/0`}>Мой профиль</Link>
            <Link to={'/task'}>Начать задание</Link>
        </div >
    )
}
