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

      if (!RetrievePlayerEndpoint) {
        console.error("Player endpoint not configured");
        return null;
      }

      console.log("Fetching player from API:", playerId);
      const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);

      if (!response.isSuccess) {
        console.log("API request failed:", response.message);
        return null;
      }

      return response.result;
    } catch (error: any) {
      console.error("Error in getPlayerById:", error);
      console.error("Error details:", {
        message: error.message,
        playerId,
      });
      return null;
    }
  },

  updatePlayer: async (playerId: string, data: any) => {
    try {
      // Validate inputs
      if (!playerId || !data) {
        console.error("Invalid playerId or data for update");
        return false;
      }

      if (!RetrievePlayerEndpoint) {
        console.error("Player endpoint not configured");
        return false;
      }

      const response = await API.put(
        `${RetrievePlayerEndpoint}/${playerId}`,
        data
      );

      if (!response.isSuccess) {
        console.error("Update player failed:", response.message);
      }

      return response.isSuccess;
    } catch (error: any) {
      console.error("Error in updatePlayer:", error);
      console.error("Error details:", {
        message: error.message,
        playerId,
      });
      return false;
    }
  },

  deletePlayer: async (playerId: string) => {
    try {
      // Validate inputs
      if (!playerId) {
        console.error("Invalid playerId for delete");
        return false;
      }

      if (!RetrievePlayerEndpoint) {
        console.error("Player endpoint not configured");
        return false;
      }

      const response = await API.delete(`${RetrievePlayerEndpoint}/${playerId}`);

      if (!response.isSuccess) {
        console.error("Delete player failed:", response.message);
      }

      return response.isSuccess;
    } catch (error: any) {
      console.error("Error in deletePlayer:", error);
      console.error("Error details:", {
        message: error.message,
        playerId,
      });
      return false;
    }
  },

  leaveGameSession: async (playerId: string) => {
    try {
      // Validate inputs
      if (!playerId) {
        console.error("❌ Invalid playerId for leaveGameSession");
        return false;
      }

      if (!PlayerLeaveEndpoint) {
        console.error("❌ Leave game endpoint not configured");
        return false;
      }

      console.log("🚪 Calling leave session API for player:", playerId);
      console.log("🔗 Endpoint:", `${PlayerLeaveEndpoint}/${playerId}`);

      const response = await API.post(`${PlayerLeaveEndpoint}/${playerId}`);

      console.log("📡 Leave session response:", response);

      if (!response.isSuccess) {
        console.error("❌ Leave session failed:", response.message);
      }

      return response.isSuccess;
    } catch (error: any) {
      console.error("❌ Error in leaveGameSession:", error);
      console.error("❌ Error details:", {
        message: error.message,
        playerId,
      });
      return false;
    }
  },
};

export default dataAccess;
