import { StyleSheet } from "react-native";
import { partyColors, partyFonts } from "./party";

export const typography = StyleSheet.create({
  h1: { fontFamily: partyFonts.display, fontSize: 32, lineHeight: 38, color: partyColors.ink },
  h2: { fontFamily: partyFonts.display, fontSize: 24, lineHeight: 30, color: partyColors.ink },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "800", color: partyColors.ink },
  body: { fontSize: 16, lineHeight: 24, color: partyColors.ink },
  bodyMuted: { fontSize: 16, lineHeight: 24, color: partyColors.muted },
  small: { fontSize: 14, lineHeight: 20, color: partyColors.muted },
  caption: { fontSize: 12, lineHeight: 18, color: partyColors.muted },
});