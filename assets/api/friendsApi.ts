import API from "./API";

export type RelationshipStatus =
  | "none"
  | "self"
  | "friends"
  | "incoming_pending"
  | "outgoing_pending";

export interface FriendProfile {
  player_id: string;
  player_name: string;
  player_email?: string | null;
  player_mobile?: string | null;
  profile_photo_url?: string | null;
  friend_code?: string | null;
  relationship_status?: RelationshipStatus | string;
  profile_visibility?: "public" | "friends" | "private" | string;
  can_view_profile?: boolean;
  can_view_game_stats?: boolean;
  share_game_stats?: boolean;
  show_online_status?: boolean;
  is_online?: boolean;
  last_seen_at?: string | null;
}

export interface FriendProfileStats {
  player_id: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_percentage: number;
  loss_percentage: number;
  draw_percentage: number;
}

export interface FriendRequest {
  id: string;
  sender_player_id: string;
  receiver_player_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "blocked" | string;
  message?: string | null;
  created_at?: string;
  responded_at?: string | null;
  sender?: FriendProfile;
  receiver?: FriendProfile;
}

export interface FriendCodeResponse {
  friend_code: string;
  allow_friend_code_search?: boolean;
  allow_phone_discovery?: boolean;
  friend_request_notifications_enabled?: boolean;
}

const unwrapArray = <T>(value: any, key: string): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.[key])) {
    return value[key];
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
};

export const friendsApi = {
  async getMyCode() {
    return API.get<FriendCodeResponse>("/friends/me/code");
  },

  async searchByCode(friendCode: string) {
    return API.post<FriendProfile>("/friends/search", {
      friend_code: friendCode.trim().toUpperCase(),
    });
  },

  async sendRequest(friendCode: string, message?: string) {
    return API.post<FriendRequest>("/friends/requests", {
      friend_code: friendCode.trim().toUpperCase(),
      ...(message?.trim() ? { message: message.trim() } : {}),
    });
  },

  async getIncomingRequests() {
    const response = await API.get<FriendRequest[] | { requests: FriendRequest[] }>(
      "/friends/requests/incoming",
    );

    return {
      ...response,
      result: unwrapArray<FriendRequest>(response.result, "requests"),
    };
  },

  async getOutgoingRequests() {
    const response = await API.get<FriendRequest[] | { requests: FriendRequest[] }>(
      "/friends/requests/outgoing",
    );

    return {
      ...response,
      result: unwrapArray<FriendRequest>(response.result, "requests"),
    };
  },

  async getFriends() {
    const response = await API.get<FriendProfile[] | { friends: FriendProfile[] }>(
      "/friends",
    );

    return {
      ...response,
      result: unwrapArray<FriendProfile>(response.result, "friends"),
    };
  },

  async getProfile(playerId: string) {
    return API.get<FriendProfile>(`/profiles/${encodeURIComponent(playerId)}`);
  },

  async getProfileStats(playerId: string) {
    return API.get<FriendProfileStats>(
      `/profiles/${encodeURIComponent(playerId)}/stats`,
    );
  },

  async acceptRequest(requestId: string) {
    return API.post<FriendRequest>(`/friends/requests/${requestId}/accept`);
  },

  async rejectRequest(requestId: string) {
    return API.post<FriendRequest>(`/friends/requests/${requestId}/reject`);
  },

  async removeFriend(friendPlayerId: string) {
    return API.delete(`/friends/${friendPlayerId}`);
  },
};
