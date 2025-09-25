import { UserContext } from "@/assets/authentication-storage/authContext";
import { AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import PhotoUploadActionSheet from "./PhotoUploadActionSheet";
import Selector from "./Selector";

interface ProfileScreenProps {
  onEditProfile: () => void;
  onNavigateToSettings: () => void; // Changed from onDeleteAccount and onLogout
}

export default function ProfileScreen({
  onEditProfile,
  onNavigateToSettings,
}: ProfileScreenProps) {
  const { user } = useContext(UserContext)!;
  const [isPhotoSheetVisible, setIsPhotoSheetVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleImageSelected = (imageUri: string) => {
    setProfileImage(imageUri);
    // Here you would typically upload the image to your server
    console.log("Profile image selected:", imageUri);
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
          <View
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
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                resizeMode="cover"
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
          </View>

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
                name={profileImage ? "edit" : "add"}
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
        title="Choose Profile Photo"
      />
    </ScrollView>
  );
}
