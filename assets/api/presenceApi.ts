import API from "./API";

export interface FriendPresence {
  player_id: string;
  is_online: boolean;
  show_online_status?: boolean;
  last_seen_at?: string | null;
}

const unwrapPresence = (value: any): FriendPresence[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.presence)) {
    return value.presence;
  }

  if (Array.isArray(value?.statuses)) {
    return value.statuses;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
};

export const presenceApi = {
  async sendHeartbeat() {
    return API.post("/presence/heartbeat");
  },

  async setOffline() {
    return API.post("/presence/offline");
  },

  async getFriendsPresence() {
    const response = await API.get<
      FriendPresence[] | { presence?: FriendPresence[]; statuses?: FriendPresence[] }
    >("/friends/presence");

    return {
      ...response,
      result: unwrapPresence(response.result),
    };
  },
};
