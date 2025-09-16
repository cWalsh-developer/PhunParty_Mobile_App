import API from "@/assets/api/API";
import { RetrievePlayerEndpoint } from "@env";

export const getPlayerById = async (playerId?: string) => {
  const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);
  return response.result;
};
