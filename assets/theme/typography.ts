import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const typography = StyleSheet.create({
  // Headings
  h1: {
    fontSize: 32, // text-4xl on mobile, text-5xl on larger screens
    fontWeight: "600",
    lineHeight: 40,
    color: colors.stone[100],
  },
  h2: {
    fontSize: 24, // text-2xl
    fontWeight: "600",
    color: colors.stone[100],
  },
  h3: {
    fontSize: 18, // text-lg
    fontWeight: "600",
    color: colors.stone[100],
  },

  // Body text
  body: {
    fontSize: 16,
    color: colors.stone[100],
    lineHeight: 24,
  },
  bodyMuted: {
    fontSize: 16,
    color: colors.stone[300],
    lineHeight: 24,
  },

  // Small text
  small: {
    fontSize: 14,
    color: colors.stone[300],
  },
  caption: {
    fontSize: 12,
    color: colors.stone[400],
  },
});
