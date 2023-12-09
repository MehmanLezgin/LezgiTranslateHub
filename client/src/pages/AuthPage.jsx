import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import api from '../api'

function AuthPage() {
    const [error, setError] = useState(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [username, setUsername] = useState(null);
    const [password, setPassword] = useState(null);

    // React.useEffect(() => {
    async function handleAuth(e) {
        e.preventDefault();

        try {
            const res = await api.post('user/signin', {
                username,
                password
            });

            const data = res.data;
            localStorage.setItem('token', data.token)
            localStorage.setItem('username', username.trim())
            setAuthenticated(true)
        } catch (e) {
            console.log(e);
            setError(`Error: ${e?.response?.data?.msg}`);
        }

    }

    return !authenticated ? (
        <div>
            <p>{error ? error : ""}</p>

            <form onSubmit={handleAuth}>
                <input type="text" placeholder="username" onChange={e => setUsername(e.target.value)} />
                <input type="password" placeholder="password" onChange={e => setPassword(e.target.value)} />
                <input type="submit" />
            </form>
        </div>
    ) : <Navigate to={'/home'} />;
}

export default AuthPage;
