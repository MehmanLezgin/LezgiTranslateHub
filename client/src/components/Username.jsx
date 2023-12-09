import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

export default function Username({ username }) {
    const location = useLocation()


return (
    <Link to={`/user/${username}`}>
        @{username}
    </Link>
);
}
