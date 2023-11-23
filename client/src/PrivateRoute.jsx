import React from 'react'
// import AuthService from './Services/AuthService'
import { Navigate, Route } from 'react-router-dom'

const PrivateRoute = ({ component: Component, ...rest }) => {

    // Add your own authentication on the below line.
    const isLoggedIn = localStorage.getItem('token')

    return (
        <Route {...rest} render={props =>
                isLoggedIn ? (
                    <Component {...props} />
                ) : (
                    <Navigate to={{ pathname: '/auth', state: { from: props.location } }} />
                )
            }
        />
    )
}

export default PrivateRoute
