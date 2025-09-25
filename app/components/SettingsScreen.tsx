import { AppButton, AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Selector from "./Selector";

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onChangePassword: () => void;
  onPrivacySettings: () => void;
  onNotificationSettings: () => void;
}

export default function SettingsScreen({
  onBack,
  onLogout,
  onDeleteAccount,
  onChangePassword,
  onPrivacySettings,
  onNotificationSettings,
}: SettingsScreenProps) {
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
          Settings
        </Text>
      </View>

      {/* Account Settings */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          Account
        </Text>

        <View style={{ gap: 12 }}>
          <Selector onPress={onChangePassword} label="Change Password">
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
                name="lock"
                size={20}
                color={colors.tea[400]}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[typography.body, { color: colors.stone[100], flex: 1 }]}
              >
                Change Password
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.stone[400]}
              />
            </TouchableOpacity>
          </Selector>

          <Selector onPress={onPrivacySettings} label="Privacy Settings">
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
                name="privacy-tip"
                size={20}
                color={colors.tea[400]}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[typography.body, { color: colors.stone[100], flex: 1 }]}
              >
                Privacy Settings
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.stone[400]}
              />
            </TouchableOpacity>
          </Selector>

          <Selector onPress={onNotificationSettings} label="Notifications">
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
                name="notifications"
                size={20}
                color={colors.tea[400]}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[typography.body, { color: colors.stone[100], flex: 1 }]}
              >
                Notification Settings
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

      {/* General Actions */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[
            typography.h3,
            { color: colors.stone[100], marginBottom: 16 },
          ]}
        >
          General
        </Text>

        <Selector onPress={onLogout} label="Logout">
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
              name="logout"
              size={20}
              color={colors.stone[300]}
              style={{ marginRight: 12 }}
            />
            <Text
              style={[typography.body, { color: colors.stone[100], flex: 1 }]}
            >
              Logout
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.stone[400]}
            />
          </TouchableOpacity>
        </Selector>
      </AppCard>

      {/* Danger Zone */}
      <AppCard
        style={{
          marginBottom: 32,
          borderColor: colors.red[600],
          borderWidth: 1,
          backgroundColor: colors.ink[800] + "80", // Subtle background
        }}
      >
        <Text
          style={[typography.h3, { color: colors.red[500], marginBottom: 8 }]}
        >
          Danger Zone
        </Text>

        <Text
          style={[
            typography.small,
            {
              color: colors.stone[400],
              marginBottom: 16,
              lineHeight: 18,
            },
          ]}
        >
          Irreversible actions that will permanently affect your account.
        </Text>

        <Selector onPress={onDeleteAccount} label="Delete Account">
          <AppButton
            title="Delete Account"
            onPress={() => {}}
            variant="delete"
            icon={
              <MaterialIcons
                name="delete-forever"
                size={18}
                color={colors.stone[100]}
              />
            }
          />
        </Selector>
      </AppCard>
    </ScrollView>
  );
}
