import axios from 'axios';

// Dynamically determine the backend API base URL based on where the browser is accessing from.
// If VITE_API_URL is set to an external domain (e.g., in production), use it.
// If VITE_API_URL contains 'localhost', dynamically replace 'localhost' with the actual hostname (e.g., 192.168.x.x)
const getBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && !envApiUrl.includes('localhost')) {
    return envApiUrl;
  }
  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
};

// Create Axios instance with base URL pointing to backend
export const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    const authState = localStorage.getItem('es-hrms-auth');
    if (authState) {
      try {
        const { state } = JSON.parse(authState);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch (e) {
        console.error('Failed to parse auth token', e);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized session. Token may have expired.');
    }
    return Promise.reject(error);
  }
);
