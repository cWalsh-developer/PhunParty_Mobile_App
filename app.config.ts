import type { ExpoConfig } from "@expo/config";

const extra = {
  AuthenticationEndpoint: process.env.AUTHENTICATION_ENDPOINT,
  SignUpEndpoint: process.env.SIGNUP_ENDPOINT,
  PasswordResetEndpoint: process.env.PASSWORD_RESET_ENDPOINT,
  PasswordResetVerificationEndpoint:
    process.env.PASSWORD_RESET_VERIFICATION_ENDPOINT,
  PasswordUpdateEndpoint: process.env.PASSWORD_UPDATE_ENDPOINT,
  RetrievePlayerEndpoint: process.env.RETRIEVE_PLAYER_ENDPOINT,
};

const config: ExpoConfig = {
  name: "PhunParty_Mobile_App",
  slug: "PhunParty_Mobile_App",
  version: "1.0.0",
  extra,
};

export default ({ config: existingConfig }: { config: ExpoConfig }) => ({
  ...existingConfig,
  extra: {
    ...existingConfig.extra,
    ...extra,
  },
});
