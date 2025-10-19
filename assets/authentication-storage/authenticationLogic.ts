import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import dataAccess from "../../databaseAccess/dataAccess";
import API from "../api/API";
import { decodeToken, getToken } from "./authStorage";

export interface LoginRequest {
  email: string;
  password: string;
}
export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
  mobile: string;
}

const {
  AuthenticationEndpoint,
  SignUpEndpoint,
  PasswordResetEndpoint,
  PasswordResetVerificationEndpoint,
  PasswordUpdateEndpoint,
  RetrievePlayerEndpoint,
} = Constants.expoConfig?.extra || {};

export const login = async (
  { email, password }: LoginRequest,
  setUser: (user: any) => void
): Promise<boolean> => {
  try {
    // Validate inputs
    if (!email || !password) {
      alert("Login failed: Email and password are required");
      return false;
    }

    if (!AuthenticationEndpoint) {
      alert("Login failed: Configuration error");
      return false;
    }

    const result = await API.post(
      AuthenticationEndpoint,
      {
        player_email: email,
        password: password,
      },
      false
    );

    if (result.isSuccess && result.result?.access_token) {
      try {
        await SecureStore.setItemAsync("jwt", result.result.access_token);
        await createUserContext(setUser);
        return true;
      } catch (storageError: any) {
        alert("Login failed: Unable to save session");
        return false;
      }
    } else {
      alert("Login failed: " + (result.message || "Invalid credentials"));
      return false;
    }
  } catch (error: any) {
    alert("Login failed: " + (error.message || "An unexpected error occurred"));
    return false;
  }
};

export const signUp = async ({
  name,
  email,
  password,
  mobile,
}: SignUpRequest): Promise<boolean> => {
  try {
    // Validate inputs
    if (!name || !email || !password || !mobile) {
      alert("Sign up failed: All fields are required");
      return false;
    }

    if (!SignUpEndpoint) {
      alert("Sign up failed: Configuration error");
      return false;
    }

    const result = await API.post(
      SignUpEndpoint,
      {
        player_name: name,
        player_email: email,
        hashed_password: password,
        player_mobile: mobile,
      },
      false
    );

    if (result.isSuccess) {
      return true;
    } else {
      alert(
        "Sign up failed: " + (result.message || "Unable to create account")
      );
      return false;
    }
  } catch (error: any) {
    alert(
      "Sign up failed: " + (error.message || "An unexpected error occurred")
    );
    return false;
  }
};

export const resetPassword = async (phone: string) => {
  try {
    // Validate inputs
    if (!phone) {
      alert("Password reset failed: Phone number is required");
      return false;
    }

    if (!PasswordResetEndpoint) {
      alert("Password reset failed: Configuration error");
      return false;
    }

    const result = await API.post(
      PasswordResetEndpoint,
      {
        phone_number: phone,
      },
      false
    );

    if (result.isSuccess) {
      return true;
    } else {
      alert(
        "Password reset failed: " +
          (result.message || "Unable to send reset code")
      );
      return false;
    }
  } catch (error: any) {
    alert(
      "Password reset failed: " +
        (error.message || "An unexpected error occurred")
    );
    return false;
  }
};

export const verifyResetCode = async (phone: string, code: string) => {
  try {
    // Validate inputs
    if (!phone || !code) {
      alert("Verification failed: Phone number and code are required");
      return false;
    }

    if (!PasswordResetVerificationEndpoint) {
      alert("Verification failed: Configuration error");
      return false;
    }

    const result = await API.post(
      PasswordResetVerificationEndpoint,
      {
        phone_number: phone,
        otp: code,
      },
      false
    );

    if (result.isSuccess) {
      return true;
    } else {
      alert(
        "Reset code verification failed: " + (result.message || "Invalid code")
      );
      return false;
    }
  } catch (error: any) {
    alert(
      "Verification failed: " +
        (error.message || "An unexpected error occurred")
    );
    return false;
  }
};

export const updatePassword = async (
  newPassword: string,
  number: string,
  setUser: (user: any) => void
) => {
  try {
    // Validate inputs
    if (!newPassword || !number) {
      alert("Password update failed: Password and phone number are required");
      return false;
    }

    if (!PasswordUpdateEndpoint) {
      alert("Password update failed: Configuration error");
      return false;
    }

    const result = await API.put(
      PasswordUpdateEndpoint,
      {
        phone_number: number,
        new_password: newPassword,
      },
      false
    );

    if (result.isSuccess) {
      if (!result.result?.access_token) {
        alert("Password update failed: Invalid server response");
        return false;
      }

      try {
        await SecureStore.setItemAsync("jwt", result.result.access_token);
        await createUserContext(setUser);
        return true;
      } catch (storageError: any) {
        alert("Password update failed: Unable to save session");
        return false;
      }
    } else {
      alert(
        "Password update failed: " +
          (result.message || "Unable to update password")
      );
      return false;
    }
  } catch (error: any) {
    alert(
      "Password update failed: " +
        (error.message || "An unexpected error occurred")
    );
    return false;
  }
};

const verifyCurrentPassword = async (
  email: string,
  password: string
): Promise<boolean> => {
  try {
    // Validate inputs
    if (!email || !password) {
      return false;
    }

    if (!AuthenticationEndpoint) {
      return false;
    }

    const result = await API.post(
      AuthenticationEndpoint,
      {
        player_email: email,
        password: password,
      },
      false
    );

    return result.isSuccess;
  } catch (error: any) {
    return false;
  }
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  phoneNumber: string,
  setUser: (user: any) => void
) => {
  try {
    // Validate inputs
    if (!currentPassword || !newPassword || !phoneNumber) {
      return {
        success: false,
        message: "All fields are required",
      };
    }

    if (!PasswordUpdateEndpoint) {
      return {
        success: false,
        message: "Configuration error",
      };
    }

    const token = await getToken();
    if (!token) {
      return {
        success: false,
        message: "No authentication token found. Please log in again.",
      };
    }

    const decodedToken = decodeToken(token);
    if (!decodedToken?.sub) {
      return {
        success: false,
        message: "Invalid authentication token. Please log in again.",
      };
    }

    let currentUser;
    try {
      currentUser = await dataAccess.getPlayerById(decodedToken.sub);
    } catch (error: any) {
      return {
        success: false,
        message: "Unable to retrieve user information",
      };
    }

    const userEmail = currentUser?.player_email;
    if (!userEmail) {
      return {
        success: false,
        message: "Unable to retrieve user email for verification",
      };
    }

    const isCurrentPasswordValid = await verifyCurrentPassword(
      userEmail,
      currentPassword
    );

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    const result = await API.put(
      PasswordUpdateEndpoint,
      {
        phone_number: phoneNumber,
        current_password: currentPassword,
        new_password: newPassword,
      },
      true
    );

    if (result.isSuccess) {
      if (result.result?.access_token) {
        try {
          await SecureStore.setItemAsync("jwt", result.result.access_token);
        } catch (storageError: any) {
          return {
            success: false,
            message: "Password changed but unable to save session",
          };
        }
      }

      try {
        await createUserContext(setUser);
      } catch (contextError: any) {
        // Password was changed, so still return success
      }

      return { success: true, message: "Password changed successfully" };
    } else {
      return {
        success: false,
        message: result.message || "Password change failed",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
    };
  }
};

export const createUserContext = async (setUser: (user: any) => void) => {
  try {
    const token = await getToken();
    if (!token) {
      return;
    }

    const decodedToken = decodeToken(token);
    if (!decodedToken?.sub) {
      return;
    }

    const currentUser = await dataAccess.getPlayerById(decodedToken.sub);

    if (!currentUser) {
      console.log("Token details:", {
        sub: decodedToken.sub,
        exp: decodedToken.exp,
      });
      return;
    }

    // Ensure all required fields exist
    if (!currentUser.player_id) {
      return;
    }

    setUser({
      player_id: currentUser.player_id,
      player_name: currentUser.player_name || "Unknown",
      player_mobile: currentUser.player_mobile || "",
      player_email: currentUser.player_email || "",
      profile_photo_url: currentUser.profile_photo_url || null,
    });
  } catch (error) {}
};
