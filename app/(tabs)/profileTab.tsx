import { UserContext } from "@/assets/authentication-storage/authContext";
import { removeToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Alert } from "react-native";
import dataAccess from "../../databaseAccess/dataAccess";
import ChangePasswordModal from "../components/ChangePasswordModal";
import EditProfileModal from "../components/EditProfileModal";
import ProfileScreen from "../components/profile";
import SettingsScreen from "../components/SettingsScreen";

export default function ProfileTab() {
  const router = useRouter();
  const { user, setUser } = useContext(UserContext)!;
  const [editVisible, setEditVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<"profile" | "settings">(
    "profile"
  );

  const handleEditProfile = () => {
    setEditVisible(true);
  };

  const handleNavigateToSettings = () => {
    setCurrentScreen("settings");
  };

  const handleBackToProfile = () => {
    setCurrentScreen("profile");
  };

  // Settings screen handlers
  const handleChangePassword = () => {
    setChangePasswordVisible(true);
  };

  const handlePrivacySettings = () => {
    // TODO: Implement privacy settings
    Alert.alert("Privacy Settings", "Privacy settings coming soon!");
  };

  const handleNotificationSettings = () => {
    // TODO: Implement notification settings
    Alert.alert("Notifications", "Notification settings coming soon!");
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: async () => {
            const playerId = user?.player_id;
            if (!playerId) throw new Error("No user ID");
            const success = await dataAccess.deletePlayer(playerId);
            if (!success) throw new Error("API delete failed");
            setUser({
              player_id: null,
              player_name: null,
              player_mobile: null,
              player_email: null,
            });
            await removeToken();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleSaveProfile = async (data: {
    player_name: string;
    player_email: string;
    player_mobile: string;
  }) => {
    setLoading(true);
    try {
      const playerId = user?.player_id;
      if (!playerId) throw new Error("No user ID");
      const success = await dataAccess.updatePlayer(playerId, data);
      if (!success) throw new Error("API update failed");
      setUser((prev: any) => ({ ...prev, ...data }));
      setEditVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: async () => {
          await removeToken();
          setUser({
            player_id: null,
            player_name: null,
            player_mobile: null,
            player_email: null,
          });
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <>
      {currentScreen === "profile" ? (
        <ProfileScreen
          onEditProfile={handleEditProfile}
          onNavigateToSettings={handleNavigateToSettings}
        />
      ) : (
        <SettingsScreen
          onBack={handleBackToProfile}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onChangePassword={handleChangePassword}
          onPrivacySettings={handlePrivacySettings}
          onNotificationSettings={handleNotificationSettings}
        />
      )}

      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        user={user}
        onSave={handleSaveProfile}
        loading={loading}
      />

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
    </>
  );
}
