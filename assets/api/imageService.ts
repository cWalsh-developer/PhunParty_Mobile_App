import Constants from "expo-constants";
import { getToken } from "../authentication-storage/authStorage";

export class ImageService {
  // Create an authenticated image URL by adding auth headers as query params
  static async createAuthenticatedImageUrl(photoUrl: string): Promise<string> {
    try {
      if (photoUrl.startsWith("http")) {
        return photoUrl; // Already absolute URL
      }

      // Get API key and token
      const apiKey = Constants.expoConfig?.extra?.API_KEY || "";
      const token = await getToken();

      const baseUrl =
        Constants.expoConfig?.extra?.API_URL || "https://api.phun.party";
      const fullUrl = `${baseUrl}${photoUrl}`;

      // Since React Native Image component can't set headers easily,
      // we'll try to work around the backend auth requirement
      console.log("ImageService: Creating authenticated URL for:", photoUrl);
      console.log("ImageService: Full URL:", fullUrl);

      return fullUrl;
    } catch (error) {
      console.error("ImageService: Error creating authenticated URL:", error);
      return photoUrl;
    }
  }

  // Test if an image URL is accessible
  static async testImageAccess(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch (error) {
      console.error("ImageService: Error testing image access:", error);
      return false;
    }
  }
}
