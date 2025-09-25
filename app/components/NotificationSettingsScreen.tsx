import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppCard } from "../../assets/components";
import Selector from "./Selector";

interface NotificationSettingsScreenProps {
  onBack: () => void;
}

interface NotificationPreferences {
  gameInvitations: boolean;
  gameStart: boolean;
  friendRequests: boolean;
  systemAnnouncements: boolean;
  sound: boolean;
  vibration: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
}

export default function NotificationSettingsScreen({
  onBack,
}: NotificationSettingsScreenProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    gameInvitations: true,
    gameStart: true,
    friendRequests: true,
    systemAnnouncements: true,
    sound: true,
    vibration: true,
    doNotDisturb: false,
    doNotDisturbStart: "22:00",
    doNotDisturbEnd: "08:00",
  });

  const [loading, setLoading] = useState(false);

  const updatePreference = (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    // TODO: Save to AsyncStorage and sync with backend
  };

  const testNotification = () => {
    Alert.alert("Test Notification", "A test notification would be sent now!", [
      { text: "OK" },
    ]);
    // TODO: Implement actual test notification
  };

  const openSystemSettings = () => {
    Alert.alert(
      "System Settings",
      "You can manage app notifications in your device's Settings app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            // TODO: Open system notification settings
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
    testable = false,
  }: {
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon: keyof typeof MaterialIcons.glyphMap;
    testable?: boolean;
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
      {testable && value && (
        <TouchableOpacity
          onPress={testNotification}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: colors.tea[400],
            borderRadius: 8,
            marginRight: 12,
          }}
        >
          <Text
            style={[
              typography.small,
              { color: colors.ink[900], fontWeight: "600" },
            ]}
          >
            Test
          </Text>
        </TouchableOpacity>
      )}
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.stone[400], true: colors.tea[400] }}
        thumbColor={value ? colors.stone[100] : colors.stone[300]}
      />
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
          Notifications
        </Text>
      </View>

      {/* System Permission Status */}
      <AppCard style={{ marginBottom: 24 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <MaterialIcons
            name="info-outline"
            size={20}
            color={colors.tea[400]}
            style={{ marginRight: 8 }}
          />
          <Text style={[typography.h3, { color: colors.stone[100] }]}>
            System Permissions
          </Text>
        </View>

        <Text
          style={[
            typography.small,
            { color: colors.stone[400], marginBottom: 12 },
          ]}
        >
          Notification permissions are required to receive alerts and updates.
        </Text>

        <Selector onPress={openSystemSettings} label="Open System Settings">
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
              name="settings"
              size={20}
              color={colors.tea[400]}
              style={{ marginRight: 12 }}
            />
            <Text
              style={[typography.body, { color: colors.stone[100], flex: 1 }]}
            >
              System Notification Settings
            </Text>
            <MaterialIcons
              name="open-in-new"
              size={18}
              color={colors.stone[400]}
            />
          </TouchableOpacity>
        </Selector>
      </AppCard>

      {/* Game Notifications */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Game Notifications
        </Text>

        <View style={{ gap: 0 }}>
          <SettingRow
            title="Game Invitations"
            subtitle="When someone invites you to play"
            value={preferences.gameInvitations}
            onValueChange={(value) =>
              updatePreference("gameInvitations", value)
            }
            icon="group-add"
            testable={true}
          />

          <SettingRow
            title="Game Start"
            subtitle="When a game you've joined is starting"
            value={preferences.gameStart}
            onValueChange={(value) => updatePreference("gameStart", value)}
            icon="play-circle-outline"
            testable={true}
          />

          <SettingRow
            title="Friend Requests"
            subtitle="When someone sends you a friend request"
            value={preferences.friendRequests}
            onValueChange={(value) => updatePreference("friendRequests", value)}
            icon="person-add"
          />
        </View>
      </AppCard>

      {/* System Notifications */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          System & Updates
        </Text>

        <SettingRow
          title="System Announcements"
          subtitle="Important updates and announcements"
          value={preferences.systemAnnouncements}
          onValueChange={(value) =>
            updatePreference("systemAnnouncements", value)
          }
          icon="campaign"
        />
      </AppCard>

      {/* Notification Style */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Notification Style
        </Text>

        <View style={{ gap: 0 }}>
          <SettingRow
            title="Sound"
            subtitle="Play notification sounds"
            value={preferences.sound}
            onValueChange={(value) => updatePreference("sound", value)}
            icon="volume-up"
            testable={true}
          />

          <SettingRow
            title="Vibration"
            subtitle="Vibrate on notifications"
            value={preferences.vibration}
            onValueChange={(value) => updatePreference("vibration", value)}
            icon="vibration"
          />
        </View>
      </AppCard>

      {/* Do Not Disturb */}
      <AppCard style={{ marginBottom: 32 }}>
        <Text
          style={[typography.h3, { color: colors.stone[100], marginBottom: 8 }]}
        >
          Do Not Disturb
        </Text>

        <Text
          style={[
            typography.small,
            { color: colors.stone[400], marginBottom: 16 },
          ]}
        >
          Pause notifications during specific hours
        </Text>

        <SettingRow
          title="Enable Do Not Disturb"
          subtitle={
            preferences.doNotDisturb
              ? `Active from ${preferences.doNotDisturbStart} to ${preferences.doNotDisturbEnd}`
              : "Disabled"
          }
          value={preferences.doNotDisturb}
          onValueChange={(value) => updatePreference("doNotDisturb", value)}
          icon="do-not-disturb"
        />

        {preferences.doNotDisturb && (
          <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
            <Text style={[typography.small, { color: colors.stone[400] }]}>
              Time range settings coming soon...
            </Text>
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}
