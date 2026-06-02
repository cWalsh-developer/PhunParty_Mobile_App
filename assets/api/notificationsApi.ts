import API from "./API";

export interface AppNotification {
  id: string;
  recipient_player_id?: string;
  actor_player_id?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  is_read: boolean;
  created_at?: string;
  read_at?: string | null;
}

export interface NotificationSettingsPayload {
  friend_request_notifications_enabled?: boolean;
  allow_friend_code_search?: boolean;
  allow_phone_discovery?: boolean;
}

export interface NotificationSettingsResponse {
  friend_request_notifications_enabled: boolean;
  allow_friend_code_search: boolean;
  allow_phone_discovery: boolean;
}

const unwrapNotifications = (value: any): AppNotification[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.notifications)) {
    return value.notifications;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
};

export const notificationsApi = {
  async getNotifications() {
    const response = await API.get<
      AppNotification[] | { notifications: AppNotification[] }
    >("/notifications");

    return {
      ...response,
      result: unwrapNotifications(response.result),
    };
  },

  async markRead(notificationId: string) {
    return API.post<AppNotification>(`/notifications/${notificationId}/read`);
  },

  async markAllRead() {
    return API.post("/notifications/read-all");
  },

  async registerPushToken(payload: {
    expo_push_token: string;
    device_id?: string | null;
    platform?: string | null;
  }) {
    return API.post("/notifications/register-push-token", payload);
  },

  async updateSettings(settings: NotificationSettingsPayload) {
    return API.patch<NotificationSettingsResponse>(
      "/notifications/settings",
      settings,
    );
  },
};
