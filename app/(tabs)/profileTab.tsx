import { UserContext } from "@/assets/authentication-storage/authContext";
import { removeToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import { Alert } from "react-native";
import dataAccess from "../../databaseAccess/dataAccess";
import EditProfileModal from "../components/EditProfileModal";
import ProfileScreen from "../components/profile";

export default function ProfileTab() {
  const router = useRouter();
  const { user, setUser } = useContext(UserContext)!;
  const [editVisible, setEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEditProfile = () => {
    setEditVisible(true);
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
      <ProfileScreen
        onEditProfile={handleEditProfile}
        onLogout={handleLogout}
      />
      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        user={user}
        onSave={handleSaveProfile}
        loading={loading}
      />
    </>
  );
}
