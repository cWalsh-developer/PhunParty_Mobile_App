import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const layoutStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink[900],
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
});

export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink[800] + "CC", // 80% opacity
    borderWidth: 1,
    borderColor: colors.ink[700],
    borderRadius: 16, // 2xl = 16px
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 8, // Android shadow
    padding: 16,
  },
});

export const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.tea[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44, // Minimum touch target
  },
  primaryText: {
    color: colors.ink[900],
    fontSize: 16,
    fontWeight: "600",
  },

  secondary: {
    backgroundColor: colors.ink[700],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  secondaryText: {
    color: colors.stone[100],
    fontSize: 16,
    fontWeight: "500",
  },

  accent: {
    backgroundColor: colors.peach[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  accentText: {
    color: colors.ink[900],
    fontSize: 16,
    fontWeight: "600",
  },

  disabled: {
    backgroundColor: colors.stone[400],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  disabledText: {
    color: colors.stone[950],
    fontSize: 16,
    fontWeight: "500",
  },
  delete: {
    backgroundColor: colors.red[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  deleteText: {
    color: colors.stone[100],
    fontSize: 16,
    fontWeight: "600",
  },
});

export const inputStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.ink[700],
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.stone[100],
    borderWidth: 0,
    minHeight: 44,
  },
  label: {
    fontSize: 14,
    color: colors.stone[300],
    marginBottom: 4,
  },
  focused: {
    borderWidth: 1,
    borderColor: colors.tea[500],
  },
  error: {
    borderWidth: 1,
    borderColor: colors.red[500],
  },
});
