import { partyColors, partyFonts } from "@/assets/theme/party";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AvatarOption, PhotoService } from "../assets/api/photoService";
import { UserContext } from "../assets/authentication-storage/authContext";
import { useToast } from "../assets/components/ToastContext";
import { AuthenticatedImage } from "./AuthenticatedImage";

interface PhotoUploadActionSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string) => void;
  onDeletePhoto?: () => void;
  hasCurrentPhoto?: boolean;
  title?: string;
}

export default function PhotoUploadActionSheet({
  isVisible,
  onClose,
  onImageSelected,
  onDeletePhoto,
  hasCurrentPhoto = false,
  title = "Choose Profile Photo",
}: PhotoUploadActionSheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const avatarSize = (Math.min(width, 560) - 64) / 3;
  const [showAvatars, setShowAvatars] = useState(false);
  const [availableAvatars, setAvailableAvatars] = useState<AvatarOption[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const userContext = useContext(UserContext);
  const { showToast } = useToast();

  const user = userContext?.user;

  const loadAvatars = async () => {
    setIsLoadingAvatars(true);
    try {
      const avatars = await PhotoService.getAvailableAvatars();
      setAvailableAvatars(avatars);
    } catch {
      showToast("Failed to load avatars", "error");
    }
    setIsLoadingAvatars(false);
  };

  const openAvatars = () => {
    setShowAvatars(true);
    if (availableAvatars.length === 0) void loadAvatars();
  };

  const closeSheet = () => {
    setShowAvatars(false);
    onClose();
  };

  const takePhoto = async () => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    console.log(
      "PhotoUploadActionSheet: Taking photo for user:",
      user.player_id,
    );
    setIsUploading(true);
    try {
      const imageUri = await PhotoService.launchCamera();

      if (imageUri) {
        const result = await PhotoService.uploadPhoto(user.player_id, imageUri);

        if (result) {
          showToast("Photo uploaded successfully!", "success");
          onImageSelected(result.photo_url);
          onClose();
        } else {
          showToast("Failed to upload photo", "error");
        }
      }
    } catch {
      showToast("Camera error occurred", "error");
    }
    setIsUploading(false);
  };

  const selectFromGallery = async () => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    setIsUploading(true);
    try {
      const imageUri = await PhotoService.launchImageLibrary();

      if (imageUri) {
        const result = await PhotoService.uploadPhoto(user.player_id, imageUri);

        if (result) {
          showToast("Photo uploaded successfully!", "success");
          onImageSelected(result.photo_url);
          onClose();
        } else {
          showToast("Failed to upload photo", "error");
        }
      }
    } catch {
      showToast("Gallery error occurred", "error");
    }
    setIsUploading(false);
  };

  const deletePhoto = () => {
    if (onDeletePhoto) {
      onDeletePhoto();
      onClose();
    }
  };

  const selectAvatar = async (avatar: AvatarOption) => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    setIsUploading(true);
    try {
      // Use the avatar endpoint with the full avatar object
      const result = await PhotoService.setAvatar(user.player_id, avatar);
      if (result) {
        showToast(`Avatar "${avatar.style}" set successfully!`, "success");
        onImageSelected(result.photo_url);
        onClose();
      } else {
        showToast("Failed to set avatar", "error");
      }
    } catch {
      showToast("Failed to set avatar", "error");
    }
    setIsUploading(false);
  };

  const renderAction = (label: string, icon: keyof typeof MaterialIcons.glyphMap, action: () => void, danger = false) => (
    <TouchableOpacity accessibilityRole="button" onPress={action} disabled={isUploading} style={[styles.action, isUploading && styles.disabled]}>
      <View style={[styles.actionIcon, danger && styles.dangerIcon]}><MaterialIcons name={icon} size={23} color={danger ? partyColors.danger : partyColors.ink} /></View>
      <Text style={[styles.actionLabel, danger && styles.dangerLabel]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={23} color={partyColors.ink} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Close photo options" />
        <View style={[styles.sheet, { maxHeight: height - insets.top - 24, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{showAvatars ? "Pick your avatar" : title}</Text>
            <TouchableOpacity onPress={closeSheet} disabled={isUploading} accessibilityRole="button" accessibilityLabel="Close photo options" style={styles.closeButton}>
              <MaterialIcons name="close" size={23} color={partyColors.ink} />
            </TouchableOpacity>
          </View>
          {!showAvatars ? (
            <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.options}>
              {renderAction("Take a photo", "camera-alt", takePhoto)}
              {renderAction("Choose from gallery", "photo-library", selectFromGallery)}
              {renderAction("Choose an avatar", "face", openAvatars)}
              {hasCurrentPhoto && renderAction("Delete photo", "delete-outline", deletePhoto, true)}
              {isUploading && <View style={styles.loading}><ActivityIndicator color={partyColors.purple} /><Text style={styles.loadingText}>Uploading photo...</Text></View>}
            </ScrollView>
          ) : (
            <View style={styles.avatarContent}>
              <TouchableOpacity onPress={() => setShowAvatars(false)} disabled={isUploading} accessibilityRole="button" style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={21} color={partyColors.ink} /><Text style={styles.backLabel}>Back to photo options</Text>
              </TouchableOpacity>
              {isLoadingAvatars ? (
                <View style={styles.loading}><ActivityIndicator color={partyColors.purple} /><Text style={styles.loadingText}>Loading avatars...</Text></View>
              ) : (
                <FlatList
                  style={styles.avatarList}
                  data={availableAvatars}
                  keyExtractor={(item) => item.name}
                  numColumns={3}
                  columnWrapperStyle={styles.avatarRow}
                  contentContainerStyle={styles.avatarGrid}
                  ListEmptyComponent={<Text style={styles.emptyText}>No avatars are available right now. Try your camera or photo library.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => selectAvatar(item)} disabled={isUploading} accessibilityRole="button" accessibilityLabel={`Use ${item.name} avatar`} style={[styles.avatar, { width: avatarSize }, isUploading && styles.disabled]}>
                      <AuthenticatedImage photoUrl={item.url} style={{ width: "100%", aspectRatio: 1 }} resizeMode="cover" />
                      <Text style={styles.avatarName}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
              {isUploading && <View style={styles.loading}><ActivityIndicator color={partyColors.purple} /><Text style={styles.loadingText}>Setting your avatar...</Text></View>}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(38, 33, 48, 0.65)", justifyContent: "flex-end" },
  sheet: { backgroundColor: partyColors.cream, width: "100%", maxWidth: 560, alignSelf: "center", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2, borderColor: partyColors.border, paddingHorizontal: 20, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  title: { flex: 1, minWidth: 0, fontFamily: partyFonts.display, fontSize: 24, lineHeight: 31, color: partyColors.ink },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: partyColors.white, borderWidth: 2, borderColor: partyColors.border, borderRadius: 16 },
  optionsScroll: { flexGrow: 0 },
  options: { gap: 12 },
  action: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: partyColors.border, borderRadius: 14, backgroundColor: partyColors.white, padding: 14 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: partyColors.lime, alignItems: "center", justifyContent: "center" },
  dangerIcon: { backgroundColor: partyColors.dangerSoft },
  actionLabel: { flex: 1, color: partyColors.ink, fontSize: 16, lineHeight: 23, fontWeight: "700" },
  dangerLabel: { color: partyColors.danger },
  disabled: { opacity: 0.6 },
  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  loadingText: { color: partyColors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  avatarContent: { flexShrink: 1 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginBottom: 12 },
  backLabel: { flex: 1, color: partyColors.ink, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  avatarList: { flexGrow: 0, flexShrink: 1 },
  avatarGrid: { gap: 12 },
  avatarRow: { justifyContent: "space-between", gap: 10 },
  avatar: { borderWidth: 1.5, borderColor: partyColors.border, borderRadius: 14, backgroundColor: partyColors.white, overflow: "hidden" },
  avatarName: { color: partyColors.ink, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 4, paddingVertical: 6 },
  emptyText: { color: partyColors.muted, fontSize: 15, lineHeight: 23, paddingVertical: 20 },
});
