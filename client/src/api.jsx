import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://192.168.0.105:3001/api/', // Set your API base URL
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
        if (error.response.status === 401) {
            window.location = '/auth/login';
        }else return Promise.reject(error);
    }
);



export default axiosInstance;