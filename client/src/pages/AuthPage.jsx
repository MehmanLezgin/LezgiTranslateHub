import React, { useState, useEffect } from "react";
import Cookies from 'js-cookie';
import { Navigate } from "react-router-dom";
import api from '../api'

function AuthPage() {
    const [error, setError] = useState(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [username, setUsername] = useState('MehmanLezgin');
    const [password, setPassword] = useState('qwer1234');

    // React.useEffect(() => {
    async function handleAuth(e) {
        e.preventDefault();

        try {
            api.post('user/signin', {
                username,
                password
            }).then(res => {
                const data = res.data;

            if (res.statusText == 'OK') {
                localStorage.setItem('token', data.token)
                console.log(data.token);
                setAuthenticated(true)
            } else {
                setError(`Error: ${data.msg}`);
            }
            })
            // .catch(e => console.log(e));
            // const res = await fetch("/api/user/signin", {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({
            //         username: username,
            //         password: password
            //     })
            // });

            
        } catch (e) {
            console.log(e);
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
