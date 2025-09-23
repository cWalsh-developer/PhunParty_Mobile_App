import { UserContext } from "@/assets/authentication-storage/authContext";
import { AppButton, AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext } from "react";
import { Text, View } from "react-native";
import Selector from "./Selector";

interface ProfileScreenProps {
  onEditProfile: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({
  onEditProfile,
  onDeleteAccount,
  onLogout,
}: ProfileScreenProps) {
  const { user } = useContext(UserContext)!;

  return (
    <View style={[layoutStyles.screen, layoutStyles.container]}>
      {/* Header */}
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <MaterialIcons
          name="account-circle"
          size={80}
          color={colors.tea[400]}
          style={{ marginBottom: 16 }}
        />
        <Text style={[typography.h1, { textAlign: "center" }]}>
          Your Profile
        </Text>
      </View>

      {/* Profile Info Card */}
      <AppCard style={{ marginBottom: 24 }}>
        <Text
          style={[typography.h3, { marginBottom: 20, textAlign: "center" }]}
        >
          Account Details
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              },
            ]}
          >
            Name
          </Text>
          <Text style={typography.body}>
            {user.player_name || "Not provided"}
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              },
            ]}
          >
            Email
          </Text>
          <Text style={typography.body}>
            {user.player_email || "Not provided"}
          </Text>
        </View>

        <View style={{ marginBottom: 0 }}>
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              },
            ]}
          >
            Mobile
          </Text>
          <Text style={typography.body}>
            {user.player_mobile || "Not provided"}
          </Text>
        </View>
      </AppCard>

      {/* Actions */}
      <View style={{ gap: 16 }}>
        <Selector onPress={onEditProfile}>
          <AppButton
            title="Edit Profile"
            onPress={() => {}}
            variant="primary"
            icon={
              <MaterialIcons name="edit" size={20} color={colors.ink[900]} />
            }
          />
        </Selector>

        <Selector onPress={onLogout} label="Logout">
          <AppButton
            title="Logout"
            onPress={() => {}}
            variant="secondary"
            icon={
              <MaterialIcons
                name="logout"
                size={20}
                color={colors.stone[100]}
              />
            }
          />
        </Selector>

        <Selector onPress={onDeleteAccount} label="Delete Account">
          <AppButton
            title="Delete Account"
            onPress={() => {}}
            variant="delete"
            icon={
              <MaterialIcons
                name="delete"
                size={20}
                color={colors.stone[100]}
              />
            }
          />
        </Selector>
      </View>
    </View>
  );
}
