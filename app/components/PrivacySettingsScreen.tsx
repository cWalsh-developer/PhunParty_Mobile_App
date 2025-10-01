import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppCard } from "../../assets/components";
import Selector from "./Selector";

interface PrivacySettingsScreenProps {
  onBack: () => void;
}

interface PrivacyPreferences {
  profileVisibility: "public" | "friends" | "private";
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  shareGameStats: boolean;
  dataCollection: boolean;
  crashReporting: boolean;
}

export default function PrivacySettingsScreen({
  onBack,
}: PrivacySettingsScreenProps) {
  const [preferences, setPreferences] = useState<PrivacyPreferences>({
    profileVisibility: "public",
    showOnlineStatus: true,
    allowFriendRequests: true,
    shareGameStats: true,
    dataCollection: true,
    crashReporting: true,
  });

  const updatePreference = (
    key: keyof PrivacyPreferences,
    value: boolean | string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    // TODO: Save to storage and sync with backend
  };

  const showPrivacyPolicy = () => {
    Alert.alert(
      "Privacy Policy",
      "Would you like to view our privacy policy?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "View Policy",
          onPress: () => {
            // TODO: Open privacy policy URL
            Linking.openURL(
              "https://terms-and-privacy.nexusgit.info/websites/phun-party/privacy"
            );
          },
        },
      ]
    );
  };

  const exportData = () => {
    Alert.alert(
      "Export Data",
      "Request a copy of your personal data. You'll receive an email with your data within 30 days.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Export",
          onPress: () => {
            // TODO: Implement data export request
            Alert.alert(
              "Request Sent",
              "We'll email you when your data export is ready."
            );
          },
        },
      ]
    );
  };

  const SettingRow = ({
    title,
    subtitle,
    value,
    onValueChange,
    icon,
  }: {
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon: keyof typeof MaterialIcons.glyphMap;
  }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.ink[700],
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <MaterialIcons
        name={icon}
        size={24}
        color={colors.tea[400]}
        style={{ marginRight: 16 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.stone[100] }]}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              typography.small,
              { color: colors.stone[400], marginTop: 2 },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.stone[400], true: colors.tea[400] }}
        thumbColor={value ? colors.stone[100] : colors.stone[300]}
      />
    </View>
  );

  const ProfileVisibilityRow = () => (
    <View
      style={{
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.ink[700],
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
      >
        <MaterialIcons
          name="visibility"
          size={24}
          color={colors.tea[400]}
          style={{ marginRight: 16 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { color: colors.stone[100] }]}>
            Profile Visibility
          </Text>
          <Text
            style={[
              typography.small,
              { color: colors.stone[400], marginTop: 2 },
            ]}
          >
            Control who can see your profile
          </Text>
        </View>
      </View>

      <View style={{ gap: 8, marginLeft: 40 }}>
        {[
          {
            key: "public",
            label: "Public",
            desc: "Anyone can see your profile",
          },
          {
            key: "friends",
            label: "Friends Only",
            desc: "Only your friends can see your profile",
          },
          {
            key: "private",
            label: "Private",
            desc: "Only you can see your profile",
          },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => updatePreference("profileVisibility", option.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor:
                preferences.profileVisibility === option.key
                  ? colors.tea[400] + "20"
                  : colors.ink[800],
              borderRadius: 8,
              borderWidth: 1,
              borderColor:
                preferences.profileVisibility === option.key
                  ? colors.tea[400]
                  : colors.ink[700],
            }}
          >
            <MaterialIcons
              name={
                preferences.profileVisibility === option.key
                  ? "radio-button-checked"
                  : "radio-button-unchecked"
              }
              size={20}
              color={
                preferences.profileVisibility === option.key
                  ? colors.tea[400]
                  : colors.stone[400]
              }
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  {
                    color:
                      preferences.profileVisibility === option.key
                        ? colors.stone[100]
                        : colors.stone[300],
                    fontSize: 14,
                  },
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  typography.small,
                  {
                    color:
                      preferences.profileVisibility === option.key
                        ? colors.stone[300]
                        : colors.stone[400],
                    fontSize: 12,
                  },
                ]}
              >
                {option.desc}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[layoutStyles.screen, layoutStyles.container]}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Header with Back Button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          style={{
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.ink[800],
            marginRight: 16,
          }}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={colors.stone[300]}
          />
        </TouchableOpacity>

        <Text style={[typography.h1, { color: colors.stone[100] }]}>
          Privacy & Security
        </Text>
      </View>

      {/* Profile Privacy */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Profile Privacy
        </Text>

        <View style={{ gap: 0 }}>
          <ProfileVisibilityRow />

          <SettingRow
            title="Show Online Status"
            subtitle="Let others see when you're online"
            value={preferences.showOnlineStatus}
            onValueChange={(value) =>
              updatePreference("showOnlineStatus", value)
            }
            icon="circle"
          />

          <SettingRow
            title="Allow Friend Requests"
            subtitle="Let others send you friend requests"
            value={preferences.allowFriendRequests}
            onValueChange={(value) =>
              updatePreference("allowFriendRequests", value)
            }
            icon="person-add"
          />
        </View>
      </AppCard>

      {/* Game Privacy */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Game Privacy
        </Text>

        <SettingRow
          title="Share Game Statistics"
          subtitle="Include your stats in leaderboards"
          value={preferences.shareGameStats}
          onValueChange={(value) => updatePreference("shareGameStats", value)}
          icon="leaderboard"
        />
      </AppCard>

      {/* Data & Analytics */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Data & Analytics
        </Text>

        <View style={{ gap: 0 }}>
          <SettingRow
            title="Usage Analytics"
            subtitle="Help improve the app by sharing usage data"
            value={preferences.dataCollection}
            onValueChange={(value) => updatePreference("dataCollection", value)}
            icon="analytics"
          />

          <SettingRow
            title="Crash Reporting"
            subtitle="Automatically send crash reports to help fix bugs"
            value={preferences.crashReporting}
            onValueChange={(value) => updatePreference("crashReporting", value)}
            icon="bug-report"
          />
        </View>
      </AppCard>

      {/* Legal & Data Rights */}
      <AppCard style={{ marginBottom: 32 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Your Data Rights
        </Text>

        <View style={{ gap: 12 }}>
          <Selector onPress={showPrivacyPolicy} label="Privacy Policy">
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.ink[700],
                borderRadius: 12,
              }}
            >
              <MaterialIcons
                name="policy"
                size={20}
                color={colors.tea[400]}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[typography.body, { color: colors.stone[100], flex: 1 }]}
              >
                Privacy Policy
              </Text>
              <MaterialIcons
                name="open-in-new"
                size={18}
                color={colors.stone[400]}
              />
            </TouchableOpacity>
          </Selector>

          <Selector onPress={exportData} label="Export Data">
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.ink[700],
                borderRadius: 12,
              }}
            >
              <MaterialIcons
                name="download"
                size={20}
                color={colors.tea[400]}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[typography.body, { color: colors.stone[100], flex: 1 }]}
              >
                Export My Data
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.stone[400]}
              />
            </TouchableOpacity>
          </Selector>
        </View>
      </AppCard>
    </ScrollView>
  );
}
