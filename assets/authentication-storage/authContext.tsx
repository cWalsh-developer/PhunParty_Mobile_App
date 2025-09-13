// auth/AuthContext.tsx
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";
import { DecodedToken, decodeToken } from "./authStorage";

interface AuthContextType {
  user: DecodedToken | null;
  token: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DecodedToken | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      const savedToken = await SecureStore.getItemAsync("jwt");
      if (savedToken) {
        setToken(savedToken);
        setUser(decodeToken(savedToken));
      }
    };
    loadToken();
  }, []);

  const logout = async () => {
    await SecureStore.deleteItemAsync("jwt");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
