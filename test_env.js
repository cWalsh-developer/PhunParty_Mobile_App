// Test your environment variables
// Run this in your terminal: npx expo start and check the console

import Constants from "expo-constants";

console.log("=== ENVIRONMENT VARIABLES DEBUG ===");
console.log("API_URL:", Constants.expoConfig?.extra?.API_URL);
console.log("API_KEY exists:", !!Constants.expoConfig?.extra?.API_KEY);
console.log(
  "API_KEY preview:",
  Constants.expoConfig?.extra?.API_KEY?.substring(0, 8) + "..."
);

// Test if we can reach the API
const testAPI = async () => {
  try {
    const baseUrl = Constants.expoConfig?.extra?.API_URL;
    if (!baseUrl) {
      console.log("❌ API_URL is not configured");
      return;
    }

    console.log("Testing API connection to:", baseUrl);

    // Test a simple endpoint
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        "X-API-Key": Constants.expoConfig?.extra?.API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    console.log("Health check response:", response.status, response.ok);
  } catch (error) {
    console.log("API connection test failed:", error);
  }
};

// testAPI(); // Uncomment to run the test
