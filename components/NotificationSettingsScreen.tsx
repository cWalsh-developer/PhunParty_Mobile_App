import { SocialHeader, SocialScreen, SocialToggle as SettingRow } from "./party/social-layout";
import { partyColors } from "@/assets/theme/party";
import { typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { openSettings } from "expo-linking";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { friendsApi } from "../assets/api/friendsApi";
import { notificationsApi } from "../assets/api/notificationsApi";
import { pushNotificationService } from "../assets/api/pushNotificationService";
import { AppCard } from "../assets/components";
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const registerCurrentDeviceForPush = async () => {
    const pushResult =
      await pushNotificationService.registerForPushNotifications();

    if (!pushResult.registered) {
      setStatusMessage(
        pushResult.message || "Push notifications could not be enabled.",
      );
      return false;
    }

    return true;
  };

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const response = await friendsApi.getMyCode();
        const friendRequestsEnabled =
          response.result?.friend_request_notifications_enabled;

        if (
          response.isSuccess &&
          typeof friendRequestsEnabled === "boolean"
        ) {
          setPreferences((prev) => ({
            ...prev,
            friendRequests: friendRequestsEnabled,
          }));

          if (friendRequestsEnabled) {
            setLoading(true);
            const registered = await registerCurrentDeviceForPush();
            if (registered) {
              setStatusMessage("This device is registered for notifications.");
            }
          }
        }
      } catch {
        setStatusMessage("Could not load notification preferences.");
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  const updatePreference = async (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    const previousPreferences = preferences;

    setPreferences({
      ...preferences,
      [key]: value,
    });
    setStatusMessage(null);

    if (key !== "friendRequests") {
      return;
    }

    setLoading(true);

    try {
      if (value) {
        const registered = await registerCurrentDeviceForPush();

        if (!registered) {
          setPreferences(previousPreferences);
          return;
        }
      }

      const response = await notificationsApi.updateSettings({
        friend_request_notifications_enabled: value,
      });

      if (!response.isSuccess) {
        setPreferences(previousPreferences);
        setStatusMessage(
          response.message || "Could not update notification preferences.",
        );
        return;
      }

      setStatusMessage(
        value
          ? "Friend request notifications enabled."
          : "Friend request notifications disabled.",
      );
    } catch (error: any) {
      setPreferences(previousPreferences);
      setStatusMessage(
        error.message || "Could not update notification preferences.",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateLocalPreference = (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
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
            openSettings();
          },
        },
      ],
    );
  };

  return (
    <SocialScreen>
      <SocialHeader title="Notifications" subtitle="Stay in the loop, your way." onBack={onBack} />

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
            color={partyColors.purple}
            style={{ marginRight: 8 }}
          />
          <Text style={[typography.h3, { color: partyColors.ink }]}>
            System Permissions
          </Text>
        </View>

        <Text
          style={[
            typography.small,
            { color: partyColors.muted, marginBottom: 12 },
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
              backgroundColor: partyColors.lavender,
              borderRadius: 12,
            }}
          >
            <MaterialIcons
              name="settings"
              size={20}
              color={partyColors.purple}
              style={{ marginRight: 12 }}
            />
            <Text
              style={[typography.body, { color: partyColors.ink, flex: 1 }]}
            >
              System Notification Settings
            </Text>
            <MaterialIcons
              name="open-in-new"
              size={18}
              color={partyColors.muted}
            />
          </TouchableOpacity>
        </Selector>
      </AppCard>

      {statusMessage && (
        <AppCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            borderColor: partyColors.purple,
            borderWidth: 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={partyColors.purple} />
          ) : (
            <MaterialIcons
              name="info-outline"
              size={20}
              color={partyColors.purple}
            />
          )}
          <Text style={[typography.small, { color: partyColors.ink, flex: 1 }]}>
            {statusMessage}
          </Text>
        </AppCard>
      )}

      {/* Game Notifications */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: partyColors.ink, marginBottom: 16 },
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
              updateLocalPreference("gameInvitations", value)
            }
            icon="group-add"
            disabled={loading}
            testable={true}
            onTest={testNotification}
          />

          <SettingRow
            title="Game Start"
            subtitle="When a game you've joined is starting"
            value={preferences.gameStart}
            onValueChange={(value) => updateLocalPreference("gameStart", value)}
            icon="play-circle-outline"
            disabled={loading}
            testable={true}
            onTest={testNotification}
          />

          <SettingRow
            title="Friend Requests"
            subtitle="When someone sends you a friend request"
            value={preferences.friendRequests}
            onValueChange={(value) => updatePreference("friendRequests", value)}
            icon="person-add"
            disabled={loading}
          />
        </View>
      </AppCard>

      {/* System Notifications */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: partyColors.ink, marginBottom: 16 },
          ]}
        >
          System & Updates
        </Text>

        <SettingRow
          title="System Announcements"
          subtitle="Important updates and announcements"
          value={preferences.systemAnnouncements}
          onValueChange={(value) =>
            updateLocalPreference("systemAnnouncements", value)
          }
          icon="campaign"
          disabled={loading}
        />
      </AppCard>

      {/* Notification Style */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: partyColors.ink, marginBottom: 16 },
          ]}
        >
          Notification Style
        </Text>

        <View style={{ gap: 0 }}>
          <SettingRow
            title="Sound"
            subtitle="Play notification sounds"
            value={preferences.sound}
            onValueChange={(value) => updateLocalPreference("sound", value)}
            icon="volume-up"
            disabled={loading}
            testable={true}
            onTest={testNotification}
          />

          <SettingRow
            title="Vibration"
            subtitle="Vibrate on notifications"
            value={preferences.vibration}
            onValueChange={(value) => updateLocalPreference("vibration", value)}
            icon="vibration"
            disabled={loading}
          />
        </View>
      </AppCard>

      {/* Do Not Disturb */}
      <AppCard style={{ marginBottom: 32 }}>
        <Text
          style={[typography.h3, { color: partyColors.ink, marginBottom: 8 }]}
        >
          Do Not Disturb
        </Text>

        <Text
          style={[
            typography.small,
            { color: partyColors.muted, marginBottom: 16 },
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
          onValueChange={(value) =>
            updateLocalPreference("doNotDisturb", value)
          }
          icon="do-not-disturb"
          disabled={loading}
        />

        {preferences.doNotDisturb && (
          <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
            <Text style={[typography.small, { color: partyColors.muted }]}>
              Time range settings coming soon...
            </Text>
          </View>
        )}
      </AppCard>
    </SocialScreen>
  );
}
