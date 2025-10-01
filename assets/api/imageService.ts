import Constants from "expo-constants";
import { getToken } from "../authentication-storage/authStorage";

export class ImageService {
  // Create an authenticated image URL by adding auth headers as query params
  static async createAuthenticatedImageUrl(photoUrl: string): Promise<string> {
    try {
      // Validate input
      if (!photoUrl) {
        console.error("ImageService: Invalid photoUrl provided");
        return "";
      }

      if (photoUrl.startsWith("http")) {
        return photoUrl; // Already absolute URL
      }

      // Get API key and token
      const apiKey = Constants.expoConfig?.extra?.API_KEY || "";
      let token = null;

      try {
        token = await getToken();
      } catch (tokenError: any) {
        console.error("ImageService: Failed to get token:", tokenError);
        // Continue without token
      }

      const baseUrl =
        Constants.expoConfig?.extra?.API_URL || "https://api.phun.party";

      if (!baseUrl) {
        console.error("ImageService: No base URL configured");
        return photoUrl;
      }

      const fullUrl = `${baseUrl}${photoUrl}`;

      // Since React Native Image component can't set headers easily,
      // we'll try to work around the backend auth requirement

      return fullUrl;
    } catch (error: any) {
      console.error("ImageService: Error creating authenticated URL:", error);
      console.error("ImageService: Error details:", {
        message: error.message,
        photoUrl,
      });
      return photoUrl;
    }
  }

  // Test if an image URL is accessible
  static async testImageAccess(url: string): Promise<boolean> {
    try {
      // Validate input
      if (!url || typeof url !== "string") {
        console.error("ImageService: Invalid URL provided for test");
        return false;
      }

      const response = await fetch(url, { method: "HEAD" });

      if (!response) {
        console.error("ImageService: No response from image URL test");
        return false;
      }

      return response.ok;
    } catch (error: any) {
      console.error("ImageService: Error testing image access:", error);
      console.error("ImageService: Error details:", {
        message: error.message,
        url,
      });
      return false;
    }
  }
}
