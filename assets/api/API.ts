//Imports
import Constants from "expo-constants";
import { getToken } from "../authentication-storage/authStorage";

// Define API result shape
interface APIResponse<T = any> {
  isSuccess: boolean;
  result?: T;
  message?: string;
}

type DataObject = Record<string, any>;

const API = {
  get: <T = any>(endpoint: string, withAuth: boolean = true) =>
    callFetch<T>(endpoint, "GET", null, withAuth),
  post: <T = any>(
    endpoint: string,
    data?: DataObject,
    withAuth: boolean = true
  ) => callFetch<T>(endpoint, "POST", data, withAuth),
  put: <T = any>(
    endpoint: string,
    data?: DataObject,
    withAuth: boolean = true
  ) => callFetch<T>(endpoint, "PUT", data, withAuth),
  delete: <T = any>(endpoint: string, withAuth: boolean = true) =>
    callFetch<T>(endpoint, "DELETE", null, withAuth),
};

export default API;

// Core fetch function
const callFetch = async <T = any>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  dataObj: DataObject | null = null,
  withAuth: boolean = true
): Promise<APIResponse<T>> => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add Authorization header if token exists
  if (withAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Use API_URL from Constants.expoConfig.extra
  const baseUrl = Constants.expoConfig?.extra?.API_URL;
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
    : endpoint;

  const requestObj: RequestInit = {
    method,
    headers,
    ...(dataObj && { body: JSON.stringify(dataObj) }),
  };

  try {
    const response = await fetch(url, requestObj);
    const result = response.status !== 204 ? await response.json() : null;

    return response.ok
      ? { isSuccess: true, result }
      : {
          isSuccess: false,
          message:
            result?.detail ||
            result?.message ||
            JSON.stringify(result) ||
            "Unknown error",
        };
  } catch (error: any) {
    return { isSuccess: false, message: error.message };
  }
};
