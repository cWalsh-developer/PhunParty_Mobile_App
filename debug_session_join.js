// Debug script to test QR scanning and session joining
// Add this temporarily to your scanQR.tsx to debug the issue

const debugSessionJoin = async (sessionCode: string) => {
  console.log("=== DEBUG SESSION JOIN ===");
  console.log("1. Session Code:", sessionCode);
  console.log("2. Session Code Length:", sessionCode.length);
  console.log(
    "3. Session Code Format Test:",
    /^[A-Z0-9]{6}$/.test(sessionCode)
  );

  // Check API configuration
  console.log("4. API_URL:", Constants.expoConfig?.extra?.API_URL);
  console.log("5. API_KEY exists:", !!Constants.expoConfig?.extra?.API_KEY);

  // Test the API endpoint manually
  try {
    const baseUrl = Constants.expoConfig?.extra?.API_URL;
    const fullUrl = `${baseUrl}/game/session/${sessionCode}/join-info`;
    console.log("6. Full API URL:", fullUrl);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "X-API-Key": Constants.expoConfig?.extra?.API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    console.log("7. Response Status:", response.status);
    console.log("8. Response OK:", response.ok);

    const result = await response.json();
    console.log("9. Response Body:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.log("10. Fetch Error:", error);
  }

  console.log("=== END DEBUG ===");
};

// Call this in your handleBarCodeScanned function before the API call:
// await debugSessionJoin(sessionCode);
