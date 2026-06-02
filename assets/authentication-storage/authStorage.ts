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
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!token) {
      return null;
    }

    const decodedToken = decodeToken(token);
    const expiresAtMs = decodedToken?.exp ? decodedToken.exp * 1000 : 0;

    if (!decodedToken || !expiresAtMs || expiresAtMs <= Date.now()) {
      await removeToken();
      return null;
    }

    return token;
  } catch {
    await removeToken();
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    
  }
};

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
};
