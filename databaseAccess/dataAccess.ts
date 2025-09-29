import API from "@/assets/api/API";
import Constants from "expo-constants";

const { RetrievePlayerEndpoint } = Constants.expoConfig?.extra || {};

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
};

export default dataAccess;
