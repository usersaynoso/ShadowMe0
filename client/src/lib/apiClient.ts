import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance with base URL and default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookies/auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token if needed
axiosInstance.interceptors.request.use(
  (config) => {
    // You could add auth token from localStorage here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific errors, like 401 for auth issues
    if (error.response?.status === 401) {
      console.error('Unauthorized - You might need to log in again');
      // Potentially redirect to login or clear auth state
    }
    console.error(`API error (${error.response?.status || 'unknown'}):`, error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

// Export apiClient with typed methods
export const apiClient = {
  get: async <T>(url: string, params?: any): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.get(url, { params });
    return response.data;
  },
  
  post: async <T>(url: string, data?: any): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.post(url, data);
    return response.data;
  },

  put: async <T>(url: string, data?: any): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.put(url, data);
    return response.data;
  },

  delete: async <T>(url: string): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.delete(url);
    return response.data;
  }
};

// TODO: Add other methods like PUT, DELETE as needed

// Basic GET request
// const get = async <T>(url: string, params?: any): Promise<T> => {
//   return axiosInstance.get<T>(url, { params });
// };

// Basic POST request
// const post = async <T>(url: string, data?: any): Promise<T> => {
//   return axiosInstance.post<T>(url, data);
// };

// TODO: Add other methods like PUT, DELETE as needed

// export const apiClient = {
//   get,
//   post,
//   // put, delete, etc.
// };