import type { ExpoConfig } from "@expo/config";

const extra = {
  AuthenticationEndpoint: process.env.AUTHENTICATION_ENDPOINT,
  SignUpEndpoint: process.env.SIGNUP_ENDPOINT,
  PasswordResetEndpoint: process.env.PASSWORD_RESET_ENDPOINT,
  PasswordResetVerificationEndpoint:
    process.env.PASSWORD_RESET_VERIFICATION_ENDPOINT,
  PasswordUpdateEndpoint: process.env.PASSWORD_UPDATE_ENDPOINT,
  RetrievePlayerEndpoint: process.env.RETRIEVE_PLAYER_ENDPOINT,
  PlayerLeaveEndpoint: process.env.PLAYER_LEAVE_ENDPOINT,
  API_KEY: process.env.API_KEY,
  API_URL: process.env.API_URL,
  API_BASE_URL: process.env.API_URL || process.env.API_BASE_URL, // Add this for WebSocket service
};

const config: ExpoConfig = {
  name: "PhunParty_Mobile_App",
  slug: "PhunParty_Mobile_App",
  version: "1.0.0",
  extra: extra,
};

export default ({ config: existingConfig }: { config: ExpoConfig }) => ({
  ...existingConfig,
  ...config,
  extra: {
    ...existingConfig.extra,
    ...extra,
  },
});
