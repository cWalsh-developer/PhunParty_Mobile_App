import Constants from "expo-constants";
import API from "../api/API";

export class DebugService {
  // Test if the avatar endpoint is accessible
  static async testAvatarEndpoint() {
    try {
      console.log("DebugService: Testing avatar endpoint...");
      const response = await API.get("photos/avatars");
      console.log("DebugService: Avatar endpoint response:", response);
      return response;
    } catch (error: any) {
      console.error("DebugService: Avatar endpoint error:", error);
      return { isSuccess: false, message: error?.message || "Unknown error" };
    }
  }

  // Test if the upload endpoint exists (without actually uploading)
  static async testUploadEndpointExists(playerId: string) {
    try {
      console.log("DebugService: Testing upload endpoint accessibility...");
      // Try a HEAD request to see if endpoint exists
      const baseUrl =
        process.env.API_URL || Constants.expoConfig?.extra?.API_URL;
      const url = `${baseUrl}/photos/upload/${playerId}`;
      console.log("DebugService: Testing URL:", url);

      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          "X-API-Key":
            process.env.API_KEY || Constants.expoConfig?.extra?.API_KEY || "",
        },
      });

      console.log("DebugService: HEAD response status:", response.status);
      console.log(
        "DebugService: HEAD response headers:",
        Object.fromEntries(response.headers.entries())
      );

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error: any) {
      console.error("DebugService: Upload endpoint test error:", error);
      return { error: error?.message || "Unknown error" };
    }
  }

  // Log current configuration
  static logConfig() {
    console.log("DebugService: Current configuration:");
    console.log(
      "- API_URL:",
      process.env.API_URL || Constants.expoConfig?.extra?.API_URL
    );
    console.log(
      "- API_KEY (length):",
      (process.env.API_KEY || Constants.expoConfig?.extra?.API_KEY || "").length
    );
  }
}

// Add to window for easy console access in development
if (__DEV__) {
  (global as any).DebugService = DebugService;
}
