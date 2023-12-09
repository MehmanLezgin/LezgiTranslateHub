import React, { useState, useEffect, Fragment } from 'react'
import { Routes, Route, Link, BrowserRouter } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

import DashboardPage from './pages/DashboardPage'
import Taskpage from './pages/TaskPage'
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage'
import UserTranslationsPage from './pages/UserTranslationsPage'
// import PrivateRoute from './PrivateRoute'
// const PrivateRoute = ({ auth: { isAuthenticated }, children }) => {
//     return isAuthenticated ? children : <Navigate to="/login" />;
// };

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate replace to="/auth" />
}


export default function App() {

// console.log('eee');
    return (
        <>
            <div>Lezgi Translate Hub</div>

            <BrowserRouter>
                <Routes>
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/home" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                    <Route path="/task" element={<PrivateRoute><Taskpage /></PrivateRoute>} />
                    <Route path="/user/:username" element={<PrivateRoute><ProfilePage/></PrivateRoute>} />
                    <Route path="/user/:username/translations" element={<PrivateRoute><UserTranslationsPage /></PrivateRoute>} />
                    <Route path="*" element={<PrivateRoute element={<DashboardPage />} />} />
                </Routes>
            </BrowserRouter>
        </>
                    /*<Route path="/home" element={<PrivateRoute element={<DashboardPage />} />} />*/
    )
}
{/* <Route path="/task" element={<PrivateRoute element={<Taskpage />} />} /> */ }
//<Route path="/task" element={<Taskpage />} />