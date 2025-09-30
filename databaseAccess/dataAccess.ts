import API from "@/assets/api/API";
import Constants from "expo-constants";

const { RetrievePlayerEndpoint, PlayerLeaveEndpoint } =
  Constants.expoConfig?.extra || {};

const dataAccess = {
  getPlayerById: async (playerId?: string) => {
    try {
      if (!playerId) {
        console.log("getPlayerById called with undefined playerId");
        return null;
      }

      console.log("Fetching player from API:", playerId);
      const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);

      if (!response.isSuccess) {
        console.log("API request failed:", response.message);
        return null;
      }

      return response.result;
    } catch (error) {
      console.error("Error in getPlayerById:", error);
      return null;
    }
  },
  updatePlayer: async (playerId: string, data: any) => {
    const response = await API.put(
      `${RetrievePlayerEndpoint}/${playerId}`,
      data
    );
    return response.isSuccess;
  },
  deletePlayer: async (playerId: string) => {
    const response = await API.delete(`${RetrievePlayerEndpoint}/${playerId}`);
    return response.isSuccess;
  },

  leaveGameSession: async (playerId: string) => {
    try {
      const response = await API.post(PlayerLeaveEndpoint, {
        player_id: playerId,
        game_code: null,
      });
      return response.isSuccess;
    } catch (error) {
      console.error("Error in leaveGameSession:", error);
      return false;
    }
  },
};

export default dataAccess;
