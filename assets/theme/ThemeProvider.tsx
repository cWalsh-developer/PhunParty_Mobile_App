import React, { createContext, useContext } from "react";
import { colors } from "./colors";
import { typography } from "./typography";

interface ThemeContextType {
  colors: typeof colors;
  typography: typeof typography;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}

const ThemeContext = createContext<ThemeContextType>({
  colors,
  typography,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ThemeContext.Provider
    value={{
      colors,
      typography,
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
      },
    }}
  >
    {children}
  </ThemeContext.Provider>
);

export const useTheme = () => useContext(ThemeContext);
