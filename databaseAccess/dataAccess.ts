import API from "@/assets/api/API";
import Constants from "expo-constants";

const { RetrievePlayerEndpoint } = Constants.expoConfig?.extra || {};

const dataAccess = {
  getPlayerById: async (playerId?: string) => {
    const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);
    return response.result;
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
