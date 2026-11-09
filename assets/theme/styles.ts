import { StyleSheet, ViewStyle } from "react-native";
import { partyColors } from "./party";

const button: ViewStyle = {
  minHeight: 54,
  paddingHorizontal: 18,
  paddingVertical: 14,
  borderRadius: 12,
  borderWidth: 2,
  borderBottomWidth: 5,
  borderColor: partyColors.border,
  alignItems: "center",
  justifyContent: "center",
};

export const layoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partyColors.cream },
  container: { flex: 1, paddingHorizontal: 20, paddingVertical: 24 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
});

export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: partyColors.white,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: partyColors.border,
    borderRadius: 18,
    padding: 20,
  },
});

const label = { color: partyColors.ink, fontSize: 16, lineHeight: 22, fontWeight: "800" as const, textAlign: "center" as const };

export const buttonStyles = StyleSheet.create({
  primary: { ...button, backgroundColor: partyColors.lime },
  primaryText: label,
  secondary: { ...button, backgroundColor: partyColors.white },
  secondaryText: label,
  accent: { ...button, backgroundColor: partyColors.pink },
  accentText: label,
  disabled: { ...button, backgroundColor: partyColors.lavender, opacity: 0.65 },
  disabledText: label,
  delete: { ...button, backgroundColor: partyColors.dangerSoft },
  deleteText: { ...label, color: partyColors.danger },
});

export const inputStyles = StyleSheet.create({
  container: {
    minHeight: 54,
    backgroundColor: partyColors.white,
    borderWidth: 2,
    borderRadius: 12,
    borderColor: partyColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: partyColors.ink,
  },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: partyColors.ink, marginBottom: 8 },
  focused: { borderColor: partyColors.purple },
  error: { borderColor: partyColors.danger },
});