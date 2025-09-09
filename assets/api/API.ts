//Imports
import { getToken } from '../authentication-storage/authStorage';

// Define API result shape
interface APIResponse<T = any> {
  isSuccess: boolean;
  result?: T;
  message?: string;
}

type DataObject = Record<string, any>;

const API = {
  get: <T = any>(endpoint: string) => callFetch<T>(endpoint, 'GET'),
  post: <T = any>(endpoint: string, data?: DataObject) => callFetch<T>(endpoint, 'POST', data),
  put: <T = any>(endpoint: string, data?: DataObject) => callFetch<T>(endpoint, 'PUT', data),
  delete: <T = any>(endpoint: string) => callFetch<T>(endpoint, 'DELETE'),
};

export default API;

// Core fetch function
const callFetch = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  dataObj: DataObject | null = null
): Promise<APIResponse<T>> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

// Add Authorization header if token exists
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestObj: RequestInit = {
    method,
    headers,
    ...(dataObj && { body: JSON.stringify(dataObj) }),
  };

  try {
    const response = await fetch(endpoint, requestObj);
    const result = response.status !== 204 ? await response.json() : null;

    return response.ok
      ? { isSuccess: true, result }
      : { isSuccess: false, message: result?.message || 'Unknown error' };
  } catch (error: any) {
    return { isSuccess: false, message: error.message };
  }
};
