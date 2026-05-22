import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Dynamically determine the backend API base URL based on where the browser is accessing from.
// If VITE_API_URL is set to an external domain (e.g., in production), use it.
// If VITE_API_URL contains 'localhost', dynamically replace 'localhost' with the actual hostname (e.g., 192.168.x.x)
const getBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl && !envApiUrl.includes('localhost')) {
    return envApiUrl;
  }
  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type FailedQueueItem = {
  resolve: (token: string) => void;
  reject: (reason?: unknown) => void;
};

const unwrapApiPayload = <T = unknown>(payload: any): T => {
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  return payload as T;
};

const getRefreshUrl = () => {
  const baseURL = axiosInstance.defaults.baseURL || getBaseUrl();
  return `${baseURL.replace(/\/$/, '')}/auth/refresh`;
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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error);
      return;
    }
    resolve(token);
  });
  failedQueue = [];
};

// Response interceptor for envelope unwrapping, centralized errors, and token refresh
axiosInstance.interceptors.response.use(
  (response) => {
    response.data = unwrapApiPayload(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/v2/auth/sso/callback');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(getRefreshUrl(), {}, { withCredentials: true });
        const refreshData = unwrapApiPayload<{ token?: string }>(refreshResponse.data);
        const newToken = refreshData.token;

        if (!newToken) {
          throw new Error('Refresh response did not include an access token.');
        }

        useAuthStore.getState().setToken(newToken);
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
