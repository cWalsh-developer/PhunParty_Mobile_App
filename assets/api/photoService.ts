import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import API from "./API";

export interface PhotoUploadResponse {
  photo_url: string;
  player_id: string;
  upload_timestamp: string;
}

export interface AvatarOption {
  name: string;
  style: string;
  seed: string;
  url: string;
  preview_url: string;
}

export class PhotoService {
  // Upload a photo from camera or gallery
  static async uploadPhoto(
    playerId: string,
    imageUri: string
  ): Promise<PhotoUploadResponse | null> {
    try {
      console.log("PhotoService: Starting photo upload for player:", playerId);
      console.log("PhotoService: Image URI:", imageUri);

      // Create form data
      const formData = new FormData();

      // Get file extension from URI
      const uriParts = imageUri.split(".");
      const fileType = uriParts[uriParts.length - 1];
      console.log("PhotoService: Detected file type:", fileType);

      // Create file object for FormData
      const fileObject: any = {
        uri: imageUri,
        name: `photo.${fileType}`,
        type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
      };

      console.log("PhotoService: File object:", fileObject);
      formData.append("file", fileObject);

      console.log("PhotoService: Making upload request...");
      // Make API call with FormData
      const response = await this.uploadFormData(
        `photos/upload/${playerId}`,
        formData
      );

      console.log("PhotoService: Upload response:", response);

      if (response.isSuccess) {
        console.log("PhotoService: Upload successful:", response.result);
        return {
          photo_url: response.result.photo_url,
          player_id: playerId,
          upload_timestamp: new Date().toISOString(),
        };
      } else {
        console.error("PhotoService: Photo upload failed:", response.message);
        return null;
      }
    } catch (error) {
      console.error("PhotoService: Error uploading photo:", error);
      return null;
    }
  }

  // Set a DiceBear avatar
  static async setAvatar(
    playerId: string,
    avatar: AvatarOption
  ): Promise<PhotoUploadResponse | null> {
    try {
      console.log(
        "PhotoService: Setting DiceBear avatar for player:",
        playerId,
        "avatar:",
        avatar.name,
        "style:",
        avatar.style,
        "seed:",
        avatar.seed
      );

      const response = await API.post(
        `photos/avatar/${playerId}?avatar_style=${avatar.style}&avatar_seed=${avatar.seed}`,
        {} // Empty body since we're using query parameters
      );

      console.log("PhotoService: Set avatar response:", response);

      if (response.isSuccess) {
        console.log("PhotoService: Avatar set successfully:", response.result);
        return {
          photo_url: response.result.photo_url,
          player_id: playerId,
          upload_timestamp: new Date().toISOString(),
        };
      } else {
        console.error("PhotoService: Avatar set failed:", response.message);
        return null;
      }
    } catch (error) {
      console.error("PhotoService: Error setting avatar:", error);
      return null;
    }
  }

  // Update user profile photo URL in user context after successful upload
  static async updateUserProfilePhoto(
    setUser: (user: any) => void,
    photoUrl: string
  ) {
    setUser((prevUser: any) => ({
      ...prevUser,
      profile_photo_url: photoUrl,
    }));
  }

  // Delete current photo
  static async deletePhoto(playerId: string): Promise<boolean> {
    try {
      console.log("PhotoService: Deleting photo for player:", playerId);
      const response = await API.delete(`photos/${playerId}/photo`);
      
      if (response.isSuccess) {
        console.log("PhotoService: Photo deleted successfully");
        return true;
      } else {
        console.error("PhotoService: Failed to delete photo:", response.message);
        return false;
      }
    } catch (error) {
      console.error("PhotoService: Error deleting photo:", error);
      return false;
    }
  }

  // Get available avatars
  static async getAvailableAvatars(): Promise<AvatarOption[]> {
    try {
      console.log("PhotoService: Fetching available DiceBear avatars...");
      const response = await API.get("photos/avatars");

      console.log("PhotoService: Avatar fetch response:", response);

      if (response.isSuccess && response.result && response.result.avatars) {
        console.log(
          "PhotoService: DiceBear avatars received:",
          response.result.avatars.length,
          "avatars"
        );
        return response.result.avatars.map((avatar: any) => ({
          name: avatar.name,
          style: avatar.style,
          seed: avatar.seed,
          url: avatar.url, // Direct DiceBear URL
          preview_url: avatar.preview_url, // Smaller preview version
        }));
      } else {
        console.error(
          "PhotoService: Failed to fetch avatars:",
          response.message
        );
        console.log(
          "PhotoService: Avatar endpoint not available, using fallback avatars"
        );
        // Fallback to some basic avatars if backend fails
        return this.getFallbackAvatars();
      }
    } catch (error) {
      console.error("PhotoService: Error fetching avatars:", error);
      // Fallback avatars if backend fails
      console.log("PhotoService: Using fallback avatars due to error");
      return this.getFallbackAvatars();
    }
  }

  // Fallback avatars using DiceBear direct API if backend is unavailable
  private static getFallbackAvatars(): AvatarOption[] {
    const styles = ["adventurer", "avataaars", "big-ears"];
    const seeds = ["fallback1", "fallback2", "fallback3", "fallback4"];

    const avatars: AvatarOption[] = [];

    styles.forEach((style, styleIndex) => {
      seeds.forEach((seed, seedIndex) => {
        avatars.push({
          name: `${style}-${seed}`,
          style: style,
          seed: seed,
          url: `https://api.dicebear.com/7.x/${style}/png?seed=${seed}`,
          preview_url: `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=64`,
        });
      });
    });

    return avatars;
  }

  // Helper method for uploading FormData (since API.ts handles JSON)
  private static async uploadFormData(endpoint: string, formData: FormData) {
    try {
      console.log(
        "PhotoService: uploadFormData called with endpoint:",
        endpoint
      );
      const baseUrl =
        process.env.API_URL || Constants.expoConfig?.extra?.API_URL;
      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
        : endpoint;

      console.log("PhotoService: Upload URL:", url);
      console.log("PhotoService: Base URL from config:", baseUrl);

      // Get auth token
      const { getToken } = await import(
        "../authentication-storage/authStorage"
      );
      const token = await getToken();

      const headers: any = {
        "X-API-Key":
          process.env.API_KEY || Constants.expoConfig?.extra?.API_KEY || "",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log(
        "PhotoService: Upload headers:",
        JSON.stringify(headers, null, 2)
      );

      // Don't set Content-Type for FormData, let fetch handle it
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      console.log("PhotoService: Upload response status:", response.status);
      console.log(
        "PhotoService: Upload response headers:",
        JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
      );

      let result = null;
      if (response.status !== 204) {
        try {
          const responseText = await response.text();
          console.log("PhotoService: Raw response:", responseText);
          
          // Try to parse as JSON
          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            console.error("PhotoService: Failed to parse JSON response:", responseText.substring(0, 500));
            result = { 
              error: "Invalid response format", 
              details: responseText.substring(0, 200) 
            };
          }
        } catch (textError) {
          console.error("PhotoService: Failed to read response text:", textError);
          result = { error: "Failed to read response" };
        }
      }
      console.log("PhotoService: Upload response body:", result);

      return response.ok
        ? { isSuccess: true, result }
        : {
            isSuccess: false,
            message: response.status === 413 
              ? "Image too large. Please try a smaller image or use lower quality."
              : result?.detail || result?.message || "Upload failed",
          };
    } catch (error: any) {
      console.error("PhotoService: uploadFormData error:", error);
      return { isSuccess: false, message: error.message };
    }
  }

  // Request camera permission
  static async requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  }

  // Request media library permission
  static async requestMediaLibraryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  }

  // Launch camera
  static async launchCamera(): Promise<string | null> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      console.log("PhotoService: Camera permission denied");
      return null;
    }

    console.log("PhotoService: Launching camera...");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images" as any, // Use string value to avoid deprecation
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // Reduced from 0.8 to 0.3 for smaller file size
    });

    console.log("PhotoService: Camera result:", {
      canceled: result.canceled,
      assetsLength: result.assets?.length,
    });

    if (!result.canceled && result.assets[0]) {
      console.log("PhotoService: Camera image selected:", result.assets[0].uri);
      return result.assets[0].uri;
    }

    return null;
  }

  // Launch image library
  static async launchImageLibrary(): Promise<string | null> {
    const hasPermission = await this.requestMediaLibraryPermission();
    if (!hasPermission) {
      console.log("PhotoService: Media library permission denied");
      return null;
    }

    console.log("PhotoService: Launching image library...");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as any, // Use string value to avoid deprecation
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // Reduced from 0.8 to 0.3 for smaller file size
    });

    console.log("PhotoService: Gallery result:", {
      canceled: result.canceled,
      assetsLength: result.assets?.length,
    });

    if (!result.canceled && result.assets[0]) {
      console.log(
        "PhotoService: Gallery image selected:",
        result.assets[0].uri
      );
      return result.assets[0].uri;
    }

    return null;
  }
}
