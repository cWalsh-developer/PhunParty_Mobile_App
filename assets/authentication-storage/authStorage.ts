import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
const TOKEN_KEY = "jwt";

export interface DecodedToken {
  sub: string; // Subject (user ID)
  exp: number; // Expiration time as a Unix timestamp
  iat: number; // Issued at time as a Unix timestamp
  [key: string]: any; // Any other custom claims
}

export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    console.error("Failed to save token:", err);
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.error("Failed to remove token:", err);
  }
};

export const decodeToken = (token: string): DecodedToken | null => {
  return jwtDecode<DecodedToken>(token);
};
