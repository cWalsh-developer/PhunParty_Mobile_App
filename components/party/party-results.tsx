import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyResult, rankPartyResults } from "@/utils/party-results";
import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PartyBrand } from "./party-brand";
import { PartyButton } from "./party-button";

export interface PartyResultsProps {
  results: PartyResult[];
  currentPlayerId: string;
  currentRosterPlayerId?: string | null;
  sessionCode: string;
  onLeave: () => void;
}

export function PartyResults({
  results,
  currentPlayerId,
  currentRosterPlayerId,
  sessionCode,
  onLeave,
}: PartyResultsProps) {
  const standings = rankPartyResults(results);
  const winners = standings.filter((player) => player.rank === 1);
  const hasResults = standings.length > 0;
  const isTie = winners.length > 1;
  const winnerNames = winners.map((player) => player.displayName).join(" & ");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <PartyBrand compact />
        <Text style={styles.roomCode}>Room {sessionCode}</Text>
      </View>

      <View style={styles.spotlight}>
        <View style={styles.trophy} accessible={false}>
          <MaterialIcons name="emoji-events" size={52} color={partyColors.ink} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {!hasResults
            ? "That's a wrap!"
            : isTie
              ? "Shared glory!"
              : `All hail ${winners[0].displayName}!`}
        </Text>
        {isTie && <Text style={styles.winnerNames}>{winnerNames}</Text>}
        <Text style={styles.spotlightDescription}>
          {hasResults
            ? `${winners[0].score.toLocaleString()} points${isTie ? " each" : ""}`
            : "Check the shared screen for the final scores."}
        </Text>
      </View>

      {hasResults && (
        <View style={styles.standings}>
          <Text accessibilityRole="header" style={styles.standingsTitle}>
            Final standings
          </Text>
          {standings.map((player, index) => {
            const isCurrentPlayer =
              player.playerId === currentPlayerId ||
              (!!currentRosterPlayerId &&
                player.rosterPlayerId === currentRosterPlayerId);

            return (
              <View
                key={`${player.rosterPlayerId || player.playerId}-${index}`}
                accessible
                accessibilityLabel={`${player.displayName}${isCurrentPlayer ? ", you" : ""}, rank ${player.rank}, ${player.score.toLocaleString()} points`}
                style={[styles.row, isCurrentPlayer && styles.currentPlayerRow]}
              >
                <View style={[styles.rankBadge, player.rank === 1 && styles.firstRankBadge]}>
                  <Text style={[styles.rank, player.rank === 1 && styles.firstRank]}>
                    {player.rank}
                  </Text>
                </View>
                <View style={styles.playerIdentity}>
                  <Text style={styles.playerName}>{player.displayName}</Text>
                  {isCurrentPlayer && <Text style={styles.youLabel}>You</Text>}
                </View>
                <View style={styles.scoreColumn}>
                  <Text style={styles.score}>{player.score.toLocaleString()}</Text>
                  <Text style={styles.pointsLabel}>points</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.nextGame}>
        <PartyButton
          title="Join another game"
          onPress={onLeave}
          icon={<MaterialIcons name="arrow-forward" size={22} color={partyColors.ink} />}
        />
        <Text style={styles.nextGameHint}>
          Your host starts the next game. Join with their room code.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: partyColors.cream,
  },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  roomCode: {
    color: partyColors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  spotlight: {
    alignItems: "center",
    backgroundColor: partyColors.pink,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: partyColors.border,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 26,
    gap: 14,
  },
  trophy: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: partyColors.cream,
    borderWidth: 2,
    borderColor: partyColors.border,
    borderRadius: 24,
    transform: [{ rotate: "-7deg" }],
  },
  title: {
    fontFamily: partyFonts.display,
    color: partyColors.ink,
    fontSize: 32,
    lineHeight: 38,
    textAlign: "center",
    letterSpacing: -0.7,
  },
  winnerNames: {
    color: partyColors.ink,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  spotlightDescription: {
    color: partyColors.ink,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  standings: {
    gap: 10,
  },
  standingsTitle: {
    fontFamily: partyFonts.display,
    color: partyColors.ink,
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 4,
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: partyColors.border,
    borderRadius: 12,
    backgroundColor: partyColors.white,
  },
  currentPlayerRow: {
    backgroundColor: partyColors.lime,
  },
  rankBadge: {
    minWidth: 32,
    minHeight: 32,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: partyColors.lavender,
  },
  firstRankBadge: {
    backgroundColor: partyColors.purple,
  },
  rank: {
    fontFamily: partyFonts.display,
    fontSize: 16,
    lineHeight: 24,
    color: partyColors.ink,
    fontVariant: ["tabular-nums"],
  },
  firstRank: {
    color: partyColors.white,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playerName: {
    color: partyColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  youLabel: {
    color: partyColors.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  scoreColumn: {
    alignItems: "flex-end",
    maxWidth: "40%",
  },
  score: {
    color: partyColors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  pointsLabel: {
    color: partyColors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  nextGame: {
    gap: 12,
  },
  nextGameHint: {
    color: partyColors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
