import type { ExpoConfig } from "@expo/config";

const extra = {
  AuthenticationEndpoint: process.env.EXPO_PUBLIC_AUTHENTICATION_ENDPOINT,
  SignUpEndpoint: process.env.EXPO_PUBLIC_SIGNUP_ENDPOINT,
  PasswordResetEndpoint: process.env.EXPO_PUBLIC_PASSWORD_RESET_ENDPOINT,
  PasswordResetVerificationEndpoint:
    process.env.EXPO_PUBLIC_PASSWORD_RESET_VERIFICATION_ENDPOINT,
  PasswordUpdateEndpoint: process.env.EXPO_PUBLIC_PASSWORD_UPDATE_ENDPOINT,
  RetrievePlayerEndpoint: process.env.EXPO_PUBLIC_RETRIEVE_PLAYER_ENDPOINT,
  PlayerLeaveEndpoint: process.env.EXPO_PUBLIC_PLAYER_LEAVE_ENDPOINT,
  API_URL: process.env.EXPO_PUBLIC_API_URL,
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL,
};

const config: ExpoConfig = {
  name: "PhunParty",
  slug: "PhunParty_Mobile_App",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "phunpartymobileapp",
  userInterfaceStyle: "dark",
  plugins: [
    "expo-font",
    "expo-image",
    "expo-status-bar",
    "expo-web-browser",
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0a0a0a",
      },
    ],
    "expo-secure-store",
    "expo-mail-composer",
    "expo-notifications",
    "./plugins/withAndroidFairPlayWindowMode",
  ],
  platforms: ["ios", "android", "web"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.phunparty.mobileapp",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.phunparty.mobileapp",
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0a0a0a",
    },
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...extra,
    eas: {
      projectId: "7b1a267b-a6e2-4c47-9e14-fed9298d0d88",
    },
  },
};

export default config;
