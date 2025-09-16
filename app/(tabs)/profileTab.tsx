import { UserContext } from "@/assets/authentication-storage/authContext";
import { removeToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import React, { useContext } from "react";
import ProfileScreen from "../components/profile";

export default function ProfileTab() {
  const router = useRouter();
  const { setUser } = useContext(UserContext)!;

  const handleEditProfile = () => {
    router.push(""); // Change to your edit profile route if needed
  };

  const handleLogout = async () => {
    await removeToken();
    setUser({
      UserID: null,
      UserName: null,
      UserPhone: null,
      UserEmail: null,
    });
    router.replace("/login");
  };

  return (
    <ProfileScreen onEditProfile={handleEditProfile} onLogout={handleLogout} />
  );
}
