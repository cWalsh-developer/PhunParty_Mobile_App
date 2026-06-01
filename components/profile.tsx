import { PhotoService } from "@/assets/api/photoService";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { AuthenticatedImage } from "./AuthenticatedImage";
import PhotoUploadActionSheet from "./PhotoUploadActionSheet";
import PhotoViewerModal from "./PhotoViewerModal";
import Selector from "./Selector";

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
        <Text style={[typography.body, { color: colors.stone[300] }]}>
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
        <Text style={[typography.body, { color: colors.stone[300] }]}>
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
    <ScrollView
      style={[layoutStyles.screen, layoutStyles.container]}
      contentContainerStyle={{ paddingBottom: 100 }} // Add bottom padding for nav bar
    >
      {/* Header */}
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        {/* Header with Settings Button */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: 16,
          }}
        >
          <View style={{ flex: 1 }} />
          <Text
            style={[
              typography.h1,
              { textAlign: "center", color: colors.stone[100] },
            ]}
          >
            Your Profile
          </Text>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Selector onPress={onNavigateToSettings} label="Settings">
              <TouchableOpacity
                style={{
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: colors.ink[800],
                }}
              >
                <MaterialIcons
                  name="settings"
                  size={20}
                  color={colors.stone[300]}
                />
              </TouchableOpacity>
            </Selector>
          </View>
        </View>

        <View
          style={{
            position: "relative",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          {/* Profile Image Container */}
          <TouchableOpacity
            onPress={() => {
              if (user.profile_photo_url) {
                setIsPhotoViewerVisible(true);
              }
            }}
            activeOpacity={user.profile_photo_url ? 0.8 : 1}
            style={{
              position: "relative",
              width: 100,
              height: 100,
              borderRadius: 50,
              overflow: "hidden",
              backgroundColor: colors.ink[700],
              borderWidth: 3,
              borderColor: colors.ink[700],
            }}
          >
            {user.profile_photo_url ? (
              <AuthenticatedImage
                photoUrl={user.profile_photo_url}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                resizeMode="cover"
                onError={(error) =>
                  console.error(
                    "Profile image failed to load:",
                    error.nativeEvent.error,
                    "URI:",
                    user.profile_photo_url
                  )
                }
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.ink[700],
                }}
              >
                <MaterialIcons
                  name="account-circle"
                  size={80}
                  color={colors.tea[400]}
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Edit Photo Button - Bottom Right Corner */}
          <Selector onPress={() => setIsPhotoSheetVisible(true)}>
            <TouchableOpacity
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                backgroundColor: colors.tea[500],
                borderRadius: 18,
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 3,
                borderColor: colors.ink[900],
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <MaterialIcons
                name={user.profile_photo_url ? "edit" : "add"}
                size={18}
                color={colors.ink[900]}
              />
            </TouchableOpacity>
          </Selector>
        </View>

        {/* Optional: Add a subtitle with user name */}
        {user.player_name && (
          <Text
            style={[
              typography.body,
              {
                textAlign: "center",
                color: colors.stone[300],
                marginTop: 8,
              },
            ]}
          >
            Welcome back, {user.player_name}!
          </Text>
        )}
      </View>

      {/* Profile Info Card */}
      <AppCard style={{ marginBottom: 24 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <Text style={[typography.h3, { color: colors.stone[100] }]}>
            Account Details
          </Text>
          <Selector onPress={onEditProfile}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: colors.ink[800],
              }}
            >
              <MaterialIcons name="edit" size={16} color={colors.tea[400]} />
              <Text
                style={[
                  typography.small,
                  { color: colors.tea[400], marginLeft: 4 },
                ]}
              >
                Edit
              </Text>
            </TouchableOpacity>
          </Selector>
        </View>

        <View
          style={{
            marginBottom: 20,
            paddingVertical: 16,
            paddingHorizontal: 16,
            backgroundColor: colors.ink[800],
            borderRadius: 12,
          }}
        >
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: "600",
              },
            ]}
          >
            Name
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.stone[100], fontSize: 16 },
            ]}
          >
            {user.player_name || "Not provided"}
          </Text>
        </View>

        <View
          style={{
            marginBottom: 20,
            paddingVertical: 16,
            paddingHorizontal: 16,
            backgroundColor: colors.ink[800],
            borderRadius: 12,
          }}
        >
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: "600",
              },
            ]}
          >
            Email
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.stone[100], fontSize: 16 },
            ]}
          >
            {user.player_email || "Not provided"}
          </Text>
        </View>

        <View
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            backgroundColor: colors.ink[800],
            borderRadius: 12,
          }}
        >
          <Text
            style={[
              typography.small,
              {
                color: colors.stone[400],
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontWeight: "600",
              },
            ]}
          >
            Mobile
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.stone[100], fontSize: 16 },
            ]}
          >
            {user.player_mobile || "Not provided"}
          </Text>
        </View>
      </AppCard>

      {/* Photo Upload Action Sheet */}
      <PhotoUploadActionSheet
        isVisible={isPhotoSheetVisible}
        onClose={() => setIsPhotoSheetVisible(false)}
        onImageSelected={handleImageSelected}
        onDeletePhoto={handleDeletePhoto}
        hasCurrentPhoto={!!user.profile_photo_url}
        title="Choose Profile Photo"
      />

      {/* Photo Viewer Modal */}
      {user.profile_photo_url && (
        <PhotoViewerModal
          visible={isPhotoViewerVisible}
          photoUri={user.profile_photo_url}
          onClose={() => setIsPhotoViewerVisible(false)}
        />
      )}
    </ScrollView>
  );
}
