import axios from 'axios';
import { Navigate } from 'react-router-dom';

const axiosInstance = axios.create({
    baseURL: '/api/', // Set your API base URL
    timeout: 5000, // Set a timeout
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // You can modify the request config here, like adding headers or tokens
        // For example, adding an authorization header with a token
        const token = localStorage.getItem('token'); // Retrieve your token from storage
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response.status;
        if (status == 401 || status == 403) {
            window.location = '/auth';
        }else return Promise.reject(error);
    }
);



export default axiosInstance;