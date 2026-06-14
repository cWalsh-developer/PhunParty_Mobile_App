import API from "./API";

export type ProfileVisibility = "public" | "friends" | "private";

export interface PrivacySettings {
  profile_visibility: ProfileVisibility;
  show_online_status: boolean;
  allow_friend_requests: boolean;
  share_game_stats: boolean;
  data_collection: boolean;
  crash_reporting: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profile_visibility: "friends",
  show_online_status: true,
  allow_friend_requests: true,
  share_game_stats: true,
  data_collection: true,
  crash_reporting: true,
};

export const privacyApi = {
  async getSettings() {
    return API.get<Partial<PrivacySettings>>("/privacy/settings");
  },

  async updateSettings(settings: Partial<PrivacySettings>) {
    return API.patch<PrivacySettings>("/privacy/settings", settings);
  },
};
