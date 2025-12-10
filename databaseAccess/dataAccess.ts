import API from "@/assets/api/API";
import Constants from "expo-constants";

const { RetrievePlayerEndpoint, PlayerLeaveEndpoint } =
  Constants.expoConfig?.extra || {};

const dataAccess = {
  getPlayerById: async (playerId?: string) => {
    try {
      if (!playerId) {
        return null;
      }

      if (!RetrievePlayerEndpoint) {
        return null;
      }

      const response = await API.get(`${RetrievePlayerEndpoint}/${playerId}`);

      if (!response.isSuccess) {
        // If we get a 500 error about "Unable to retrieve player information",
        // the JWT token is likely stale. Clear it to force re-authentication.
        if (
          response.message?.includes("Unable to retrieve player information")
        ) {
          console.warn("⚠️ Stale authentication detected, clearing token");
          const { removeToken } = await import(
            "@/assets/authentication-storage/authStorage"
          );
          await removeToken();
        }
        return null;
      }

      return response.result;
    } catch (error: any) {
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
        return false;
      }

      if (!RetrievePlayerEndpoint) {
        return false;
      }

      const response = await API.put(
        `${RetrievePlayerEndpoint}/${playerId}`,
        data
      );

      if (!response.isSuccess) {
      }

      return response.isSuccess;
    } catch (error: any) {
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
        return false;
      }

      if (!RetrievePlayerEndpoint) {
        return false;
      }

      const response = await API.delete(
        `${RetrievePlayerEndpoint}/${playerId}`
      );

      if (!response.isSuccess) {
      }

      return response.isSuccess;
    } catch (error: any) {
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
        return false;
      }

      if (!PlayerLeaveEndpoint) {
        return false;
      }

      const response = await API.post(`${PlayerLeaveEndpoint}/${playerId}`);

      if (response.isSuccess) {
        return true;
      } else {
        // Leave failed - this might be because player wasn't in a session
        // or because of a backend issue. Log as info, not error.
        const lowerMsg = response.message?.toLowerCase() || "";
        if (lowerMsg.includes("not in") || lowerMsg.includes("no active")) {
        } else {
        }
        return false;
      }
    } catch (error: any) {
      // Log as info since leave failures are often expected

      return false;
    }
  },
};

export default dataAccess;
