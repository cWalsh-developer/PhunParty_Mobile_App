import { generateDataPrivacyPDF } from "@/assets/api/generatePDF";
import {
  DEFAULT_PRIVACY_SETTINGS,
  privacyApi,
  PrivacySettings,
} from "@/assets/api/privacyApi";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppCard } from "../assets/components";
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

const PROFILE_VISIBILITY_OPTIONS = [
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
] as const;

function SettingRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
}) {
  return (
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
        disabled={disabled}
        trackColor={{ false: colors.stone[400], true: colors.tea[400] }}
        thumbColor={value ? colors.stone[100] : colors.stone[300]}
      />
    </View>
  );
}

function ProfileVisibilityRow({
  value,
  disabled,
  onChange,
}: {
  value: PrivacyPreferences["profileVisibility"];
  disabled: boolean;
  onChange: (value: PrivacyPreferences["profileVisibility"]) => void;
}) {
  return (
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
        {PROFILE_VISIBILITY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor:
                value === option.key ? colors.tea[400] + "20" : colors.ink[800],
              borderRadius: 8,
              borderWidth: 1,
              borderColor:
                value === option.key ? colors.tea[400] : colors.ink[700],
            }}
          >
            <MaterialIcons
              name={
                value === option.key
                  ? "radio-button-checked"
                  : "radio-button-unchecked"
              }
              size={20}
              color={
                value === option.key ? colors.tea[400] : colors.stone[400]
              }
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  {
                    color:
                      value === option.key
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
                      value === option.key
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
}

export default function PrivacySettingsScreen({
  onBack,
}: PrivacySettingsScreenProps) {
  const { user } = useContext(UserContext)!;
  const [preferences, setPreferences] = useState<PrivacyPreferences>({
    profileVisibility: DEFAULT_PRIVACY_SETTINGS.profile_visibility,
    showOnlineStatus: DEFAULT_PRIVACY_SETTINGS.show_online_status,
    allowFriendRequests: DEFAULT_PRIVACY_SETTINGS.allow_friend_requests,
    shareGameStats: DEFAULT_PRIVACY_SETTINGS.share_game_stats,
    dataCollection: DEFAULT_PRIVACY_SETTINGS.data_collection,
    crashReporting: DEFAULT_PRIVACY_SETTINGS.crash_reporting,
  });
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof PrivacyPreferences | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const mapSettingsToPreferences = (
    settings?: Partial<PrivacySettings>,
  ): PrivacyPreferences => ({
    profileVisibility:
      settings?.profile_visibility ?? DEFAULT_PRIVACY_SETTINGS.profile_visibility,
    showOnlineStatus:
      settings?.show_online_status ?? DEFAULT_PRIVACY_SETTINGS.show_online_status,
    allowFriendRequests:
      settings?.allow_friend_requests ??
      DEFAULT_PRIVACY_SETTINGS.allow_friend_requests,
    shareGameStats:
      settings?.share_game_stats ?? DEFAULT_PRIVACY_SETTINGS.share_game_stats,
    dataCollection:
      settings?.data_collection ?? DEFAULT_PRIVACY_SETTINGS.data_collection,
    crashReporting:
      settings?.crash_reporting ?? DEFAULT_PRIVACY_SETTINGS.crash_reporting,
  });

  const mapPreferenceToSettings = (
    key: keyof PrivacyPreferences,
    value: boolean | string,
  ): Partial<PrivacySettings> => {
    switch (key) {
      case "profileVisibility":
        return {
          profile_visibility: value as PrivacySettings["profile_visibility"],
        };
      case "showOnlineStatus":
        return { show_online_status: Boolean(value) };
      case "allowFriendRequests":
        return { allow_friend_requests: Boolean(value) };
      case "shareGameStats":
        return { share_game_stats: Boolean(value) };
      case "dataCollection":
        return { data_collection: Boolean(value) };
      case "crashReporting":
        return { crash_reporting: Boolean(value) };
      default:
        return {};
    }
  };

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      setStatusMessage(null);

      try {
        const response = await privacyApi.getSettings();

        if (!response.isSuccess) {
          setStatusMessage(
            response.message || "Could not load privacy settings.",
          );
          return;
        }

        setPreferences(mapSettingsToPreferences(response.result));
      } catch (error: any) {
        setStatusMessage(
          error.message || "Could not load privacy settings.",
        );
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  const updatePreference = async (
    key: keyof PrivacyPreferences,
    value: boolean | string,
  ) => {
    const previousPreferences = preferences;

    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSavingKey(key);
    setStatusMessage(null);

    try {
      const response = await privacyApi.updateSettings(
        mapPreferenceToSettings(key, value),
      );

      if (!response.isSuccess) {
        setPreferences(previousPreferences);
        setStatusMessage(
          response.message || "Could not update privacy settings.",
        );
        return;
      }

      if (response.result) {
        setPreferences(mapSettingsToPreferences(response.result));
      }
    } catch (error: any) {
      setPreferences(previousPreferences);
      setStatusMessage(
        error.message || "Could not update privacy settings.",
      );
    } finally {
      setSavingKey(null);
    }
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
              "https://terms-and-privacy.nexusgit.info/websites/phun-party/privacy",
            );
          },
        },
      ],
    );
  };

  const exportData = async () => {
    if (!user?.player_email) {
      Alert.alert(
        "No Email Address",
        "We don't have an email address on file for your account. Please add an email address in your profile settings first.",
      );
      return;
    }
    Alert.alert(
      "Email Data Report",
      `Send your data privacy report to ${user.player_email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: async () => {
            try {
              const result = await generateDataPrivacyPDF(user, {
                sendEmail: true,
              });

              if (result.success) {
                if (result.method === "email") {
                  Alert.alert(
                    "Email Sent",
                    "Your data privacy report has been sent to your email address.",
                  );
                } else if (result.method === "draft") {
                  Alert.alert(
                    "Email Draft Created",
                    "An email draft with your data privacy report has been created. Please check your mail app to send it.",
                  );
                }
              }
            } catch {
              Alert.alert(
                "Error",
                "Failed to generate or email your data export. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

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
      {statusMessage && (
        <AppCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            borderColor: colors.tea[400],
            borderWidth: 1,
          }}
        >
          {loading || savingKey ? (
            <ActivityIndicator color={colors.tea[400]} />
          ) : (
            <MaterialIcons
              name="info-outline"
              size={20}
              color={colors.tea[400]}
            />
          )}
          <Text
            style={[typography.small, { color: colors.stone[100], flex: 1 }]}
          >
            {statusMessage}
          </Text>
        </AppCard>
      )}

      {loading && !statusMessage && (
        <AppCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <ActivityIndicator color={colors.tea[400]} />
          <Text
            style={[typography.small, { color: colors.stone[100], flex: 1 }]}
          >
            Loading privacy settings...
          </Text>
        </AppCard>
      )}

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
          <ProfileVisibilityRow
            value={preferences.profileVisibility}
            disabled={loading || savingKey !== null}
            onChange={(value) => updatePreference("profileVisibility", value)}
          />

          <SettingRow
            title="Show Online Status"
            subtitle="Let others see when you're online"
            value={preferences.showOnlineStatus}
            onValueChange={(value) =>
              updatePreference("showOnlineStatus", value)
            }
            icon="circle"
            disabled={loading || savingKey !== null}
          />

          <SettingRow
            title="Allow Friend Requests"
            subtitle="Let others send you friend requests"
            value={preferences.allowFriendRequests}
            onValueChange={(value) =>
              updatePreference("allowFriendRequests", value)
            }
            icon="person-add"
            disabled={loading || savingKey !== null}
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
          disabled={loading || savingKey !== null}
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
            disabled={loading || savingKey !== null}
          />

          <SettingRow
            title="Crash Reporting"
            subtitle="Automatically send crash reports to help fix bugs"
            value={preferences.crashReporting}
            onValueChange={(value) => updatePreference("crashReporting", value)}
            icon="bug-report"
            disabled={loading || savingKey !== null}
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
