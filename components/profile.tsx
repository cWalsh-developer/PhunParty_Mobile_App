import { partyColors, partyFonts } from "@/assets/theme/party";
import { PhotoService } from "@/assets/api/photoService";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { AppButton, AppCard } from "@/assets/components";
import { layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AuthenticatedImage } from "./AuthenticatedImage";
import PhotoUploadActionSheet from "./PhotoUploadActionSheet";
import PhotoViewerModal from "./PhotoViewerModal";
import { SocialHeader, SocialScreen } from "./party/social-layout";

interface ProfileScreenProps {
  onEditProfile: () => void;
  onNavigateToSettings: () => void; // Changed from onDeleteAccount and onLogout
}

export default function ProfileScreen({
  onEditProfile,
  onNavigateToSettings,
}: ProfileScreenProps) {
  const userContext = useContext(UserContext);
  const [isPhotoSheetVisible, setIsPhotoSheetVisible] = useState(false);
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  if (!userContext) {
    return (
      <View
        style={[
          layoutStyles.screen,
          layoutStyles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={[typography.body, { color: partyColors.muted }]}>
          User context not available
        </Text>
      </View>
    );
  }

  const { user, setUser } = userContext;

  // Early return if user is not loaded yet
  if (!user || !user.player_id) {
    return (
      <View
        style={[
          layoutStyles.screen,
          layoutStyles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={[typography.body, { color: partyColors.muted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  const handleImageSelected = (imageUri: string) => {
    // Update the user context with the new profile photo URL
    setUser((prevUser) => {
      const updatedUser = {
        ...prevUser,
        profile_photo_url: imageUri,
      };
      return updatedUser;
    });
  };

  const handleDeletePhoto = async () => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete your profile photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingPhoto(true);
            try {
              if (!user.player_id) {
                Alert.alert("Error", "Player ID not found. Please try again.");
                return;
              }

              const success = await PhotoService.deletePhoto(user.player_id);
              if (success) {
                // Update user context to remove photo
                setUser((prevUser) => ({
                  ...prevUser,
                  profile_photo_url: null,
                }));
              } else {
                Alert.alert(
                  "Error",
                  "Failed to delete photo. Please try again."
                );
              }
            } catch (error) {
              console.error("Profile: Error deleting photo:", error);
              Alert.alert("Error", "Failed to delete photo. Please try again.");
            } finally {
              setIsDeletingPhoto(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SocialScreen>
      <SocialHeader title="Your profile" subtitle="The face behind the friendly competition."
        action={<TouchableOpacity onPress={onNavigateToSettings} accessibilityRole="button" accessibilityLabel="Open settings" style={styles.settingsButton}><MaterialIcons name="settings" size={23} color={partyColors.ink} /></TouchableOpacity>}
      />
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => user.profile_photo_url ? setIsPhotoViewerVisible(true) : setIsPhotoSheetVisible(true)}
          accessibilityRole="button" accessibilityLabel={user.profile_photo_url ? "View profile photo" : "Add profile photo"} style={styles.photo}>
          {user.profile_photo_url ? <AuthenticatedImage photoUrl={user.profile_photo_url} style={styles.photoImage} resizeMode="cover" /> : <MaterialIcons name="person-outline" size={70} color={partyColors.ink} />}
        </TouchableOpacity>
        <Text style={styles.playerName}>{user.player_name || "Your profile"}</Text>
        <TouchableOpacity onPress={() => setIsPhotoSheetVisible(true)} accessibilityRole="button" accessibilityLabel={isDeletingPhoto ? "Removing photo" : "Change photo"} disabled={isDeletingPhoto} style={styles.photoButton}>
          <MaterialIcons name="add-a-photo" size={20} color={partyColors.ink} />
          <Text style={styles.photoButtonText}>{isDeletingPhoto ? "Removing photo..." : "Change photo"}</Text>
        </TouchableOpacity>
      </View>
      <AppCard style={styles.detailsCard}>
        <Text accessibilityRole="header" style={styles.detailsTitle}>Account details</Text>
        <ProfileDetail label="Name" value={user.player_name} />
        <ProfileDetail label="Email" value={user.player_email} />
        <ProfileDetail label="Mobile" value={user.player_mobile} />
        <AppButton title="Edit profile" onPress={onEditProfile} icon={<MaterialIcons name="edit" size={20} color={partyColors.ink} />} />
      </AppCard>
      <PhotoUploadActionSheet isVisible={isPhotoSheetVisible} onClose={() => setIsPhotoSheetVisible(false)} onImageSelected={handleImageSelected} onDeletePhoto={handleDeletePhoto} hasCurrentPhoto={!!user.profile_photo_url} title="Choose profile photo" />
      {user.profile_photo_url && <PhotoViewerModal visible={isPhotoViewerVisible} photoUri={user.profile_photo_url} onClose={() => setIsPhotoViewerVisible(false)} />}
    </SocialScreen>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string | null }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value || "Not provided"}</Text></View>;
}

const styles = StyleSheet.create({
  settingsButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: partyColors.white, borderWidth: 2, borderColor: partyColors.border, borderRadius: 16 },
  hero: { alignItems: "center", backgroundColor: partyColors.pink, padding: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: partyColors.border, borderRadius: 22, gap: 16, marginBottom: 24 },
  photo: { width: 120, height: 120, borderRadius: 40, borderWidth: 3, borderColor: partyColors.border, backgroundColor: partyColors.cream, overflow: "hidden", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-3deg" }] },
  photoImage: { width: "100%", height: "100%" },
  playerName: { fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 26, lineHeight: 34, textAlign: "center" },
  photoButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: partyColors.border, backgroundColor: partyColors.white },
  photoButtonText: { color: partyColors.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  detailsCard: { padding: 20, gap: 16 },
  detailsTitle: { fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 20, lineHeight: 28 },
  detail: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: partyColors.lavender, gap: 6 },
  detailLabel: { color: partyColors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  detailValue: { color: partyColors.ink, fontSize: 16, lineHeight: 24 },
});
