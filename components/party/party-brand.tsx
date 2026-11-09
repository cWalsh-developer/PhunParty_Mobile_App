import { partyColors, partyFonts } from "@/assets/theme/party";
import { Image } from "expo-image";
import { StyleSheet, Text, useWindowDimensions } from "react-native";

export function PartyBrand({ compact = false }: { compact?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <Text
      accessibilityLabel="Phun Party"
      allowFontScaling={false}
      style={[styles.wordmark, width < 360 && styles.narrow, compact && styles.compact]}
    >
      {compact ? "PHUN PARTY" : "PHUN\nPARTY"}
    </Text>
  );
}

export function PartyMascot({ size = 92 }: { size?: number }) {
  return (
    <Image
      source={require("@/assets/images/party-star.svg")}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: partyFonts.display,
    color: partyColors.ink,
    fontSize: 54,
    lineHeight: 53,
    letterSpacing: -2,
  },
  compact: { fontSize: 18, lineHeight: 24, letterSpacing: -0.5 },
  narrow: { fontSize: 43, lineHeight: 44, letterSpacing: -1.5 },
});
