import API from "@/assets/api/API";
import { RetrievePlayerEndpoint } from "@env";

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
};

export default dataAccess;
