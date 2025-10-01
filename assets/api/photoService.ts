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
      // Validate inputs
      if (!playerId || !imageUri) {
        console.error("PhotoService: Invalid playerId or imageUri");
        return null;
      }

      // Create form data
      const formData = new FormData();

      // Get file extension from URI
      const uriParts = imageUri.split(".");
      const fileType = uriParts[uriParts.length - 1];

      if (!fileType) {
        console.error("PhotoService: Unable to determine file type from URI");
        return null;
      }

      // Create file object for FormData
      const fileObject: any = {
        uri: imageUri,
        name: `photo.${fileType}`,
        type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
      };

      formData.append("file", fileObject);

      // Make API call with FormData
      const response = await this.uploadFormData(
        `photos/upload/${playerId}`,
        formData
      );

      console.log("PhotoService: Upload response:", response);

      if (response.isSuccess) {
        console.log("PhotoService: Upload successful:", response.result);

        if (!response.result?.photo_url) {
          console.error("PhotoService: No photo URL in response");
          return null;
        }

        return {
          photo_url: response.result.photo_url,
          player_id: playerId,
          upload_timestamp: new Date().toISOString(),
        };
      } else {
        console.error("PhotoService: Photo upload failed:", response.message);
        return null;
      }
    } catch (error: any) {
      console.error("PhotoService: Error uploading photo:", error);
      console.error("PhotoService: Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return null;
    }
  }

  // Set a DiceBear avatar
  static async setAvatar(
    playerId: string,
    avatar: AvatarOption
  ): Promise<PhotoUploadResponse | null> {
    try {
      // Validate inputs
      if (!playerId || !avatar?.style || !avatar?.seed) {
        console.error("PhotoService: Invalid playerId or avatar data");
        return null;
      }

      const response = await API.post(
        `photos/avatar/${playerId}?avatar_style=${avatar.style}&avatar_seed=${avatar.seed}`,
        {} // Empty body since we're using query parameters
      );

      if (response.isSuccess) {
        if (!response.result?.photo_url) {
          console.error("PhotoService: No photo URL in avatar response");
          return null;
        }

        return {
          photo_url: response.result.photo_url,
          player_id: playerId,
          upload_timestamp: new Date().toISOString(),
        };
      } else {
        console.error("PhotoService: Avatar set failed:", response.message);
        return null;
      }
    } catch (error: any) {
      console.error("PhotoService: Error setting avatar:", error);
      console.error("PhotoService: Error details:", {
        message: error.message,
        playerId,
        avatarStyle: avatar?.style,
      });
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
      const response = await API.delete(`photos/${playerId}/photo`);

      if (response.isSuccess) {
        return true;
      } else {
        console.error(
          "PhotoService: Failed to delete photo:",
          response.message
        );
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

      // Validate inputs
      if (!endpoint || !formData) {
        console.error("PhotoService: Invalid endpoint or formData");
        return {
          isSuccess: false,
          message: "Invalid upload parameters",
        };
      }

      const baseUrl =
        process.env.API_URL || Constants.expoConfig?.extra?.API_URL;

      if (!baseUrl) {
        console.error("PhotoService: API URL not configured");
        return {
          isSuccess: false,
          message: "API configuration error",
        };
      }

      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
        : endpoint;

      console.log("PhotoService: Upload URL:", url);
      console.log("PhotoService: Base URL from config:", baseUrl);

      // Get auth token
      let token = null;
      try {
        const { getToken } = await import(
          "../authentication-storage/authStorage"
        );
        token = await getToken();
      } catch (tokenError: any) {
        console.error("PhotoService: Failed to get auth token:", tokenError);
        // Continue without token - some endpoints might not require it
      }

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

      if (!response) {
        console.error("PhotoService: No response from server");
        return {
          isSuccess: false,
          message: "Network error: No response from server",
        };
      }

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
            result = responseText ? JSON.parse(responseText) : null;
          } catch (parseError: any) {
            console.error(
              "PhotoService: Failed to parse JSON response:",
              responseText.substring(0, 500)
            );
            result = {
              error: "Invalid response format",
              details: responseText.substring(0, 200),
            };
          }
        } catch (textError: any) {
          console.error(
            "PhotoService: Failed to read response text:",
            textError
          );
          result = { error: "Failed to read response" };
        }
      }
      console.log("PhotoService: Upload response body:", result);

      return response.ok
        ? { isSuccess: true, result }
        : {
            isSuccess: false,
            message:
              response.status === 413
                ? "Image too large. Please try a smaller image or use lower quality."
                : result?.detail || result?.message || "Upload failed",
          };
    } catch (error: any) {
      console.error("PhotoService: uploadFormData error:", error);
      console.error("PhotoService: Error type:", error.name);

      // Handle specific error types
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        return {
          isSuccess: false,
          message: "Network error: Unable to connect to server",
        };
      }

      if (error.name === "AbortError") {
        return { isSuccess: false, message: "Upload timeout" };
      }

      return {
        isSuccess: false,
        message: error.message || "An unexpected error occurred during upload",
      };
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
