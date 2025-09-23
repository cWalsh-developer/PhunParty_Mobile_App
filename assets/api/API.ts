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
  const apiKey = Constants.expoConfig?.extra?.API_KEY || "";

  const headers: HeadersInit = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };

  // Add Authorization header if token exists
  if (withAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Use endpoint directly if it's a full URL, otherwise combine with base URL
  const baseUrl = Constants.expoConfig?.extra?.API_URL;
  const url = endpoint.startsWith("https")
    ? endpoint
    : baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
    : endpoint;

  const requestObj: RequestInit = {
    method,
    headers,
    ...(dataObj && { body: JSON.stringify(dataObj) }),
  };

  try {
    console.log("Making API call to:", url);
    console.log("Headers:", JSON.stringify(headers, null, 2));
    const response = await fetch(url, requestObj);
    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
    );
    const result = response.status !== 204 ? await response.json() : null;

    if (!response.ok) {
      console.log("Error response body:", JSON.stringify(result, null, 2));
    }

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
