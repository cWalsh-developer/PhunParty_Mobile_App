import { UserContext } from "@/assets/authentication-storage/authContext";
import { removeToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Alert } from "react-native";
import dataAccess from "../../databaseAccess/dataAccess";
import ChangePasswordModal from "../components/ChangePasswordModal";
import EditProfileModal from "../components/EditProfileModal";
import NotificationSettingsScreen from "../components/NotificationSettingsScreen";
import PrivacySettingsScreen from "../components/PrivacySettingsScreen";
import ProfileScreen from "../components/profile";
import SettingsScreen from "../components/SettingsScreen";

type ScreenType = "profile" | "settings" | "notifications" | "privacy";

export default function ProfileTab() {
  const router = useRouter();
  const { user, setUser } = useContext(UserContext)!;
  const [editVisible, setEditVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("profile");

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
    setCurrentScreen("privacy");
  };

  const handleNotificationSettings = () => {
    setCurrentScreen("notifications");
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
            try {
              const playerId = user?.player_id;
              if (!playerId) {
                Alert.alert(
                  "Error",
                  "User ID not found. Please try logging out and back in."
                );
                return;
              }
              const success = await dataAccess.deletePlayer(playerId);
              if (!success) {
                Alert.alert(
                  "Error",
                  "Failed to delete account. Please try again."
                );
                return;
              }
              setUser({
                player_id: null,
                player_name: null,
                player_mobile: null,
                player_email: null,
                profile_photo_url: null,
              });
              await removeToken();
              router.replace("/login");
            } catch (error) {

              Alert.alert(
                "Error",
                "Failed to delete account. Please try again."
              );
            }
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
      if (!playerId) {
        Alert.alert(
          "Error",
          "User ID not found. Please try logging out and back in."
        );
        setLoading(false);
        return;
      }
      const success = await dataAccess.updatePlayer(playerId, data);
      if (!success) {
        Alert.alert("Error", "Failed to update profile. Please try again.");
        setLoading(false);
        return;
      }
      setUser((prev: any) => ({ ...prev, ...data }));
      setEditVisible(false);
    } catch (error) {

      Alert.alert("Error", "Failed to update profile. Please try again.");
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
            profile_photo_url: null,
          });
          router.replace("/login");
        },
      },
    ]);
  };

  // Early return if user is not loaded yet
  if (!user) {
    return null; // or a loading screen
  }

  return (
    <>
      {currentScreen === "profile" ? (
        <ProfileScreen
          onEditProfile={handleEditProfile}
          onNavigateToSettings={handleNavigateToSettings}
        />
      ) : currentScreen === "settings" ? (
        <SettingsScreen
          onBack={handleBackToProfile}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onChangePassword={handleChangePassword}
          onPrivacySettings={handlePrivacySettings}
          onNotificationSettings={handleNotificationSettings}
        />
      ) : currentScreen === "notifications" ? (
        <NotificationSettingsScreen
          onBack={() => setCurrentScreen("settings")}
        />
      ) : (
        <PrivacySettingsScreen onBack={() => setCurrentScreen("settings")} />
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
