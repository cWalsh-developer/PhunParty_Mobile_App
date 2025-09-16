import API from "@/assets/api/API";
import { RetrievePlayerEndpoint } from "@env";

const dataAccess = {
  getPlayerById: async (playerId?: string) => {
    const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);
    return response.result;
  },
};

export default dataAccess;
