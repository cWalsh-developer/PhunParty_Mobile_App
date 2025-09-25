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
  const result = await API.post(
    AuthenticationEndpoint,
    {
      player_email: email,
      password: password,
    },
    false
  );
  if (result.isSuccess && result.result?.access_token) {
    await SecureStore.setItemAsync("jwt", result.result.access_token);
    await createUserContext(setUser);
    return true;
  } else {
    alert("Login failed: " + result.message);
    return false;
  }
};

export const signUp = async ({
  name,
  email,
  password,
  mobile,
}: SignUpRequest): Promise<boolean> => {
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
    alert("Sign up failed: " + result.message);
    return false;
  }
};

export const resetPassword = async (phone: string) => {
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
    alert("Password reset failed: " + result.message);
    return false;
  }
};

export const verifyResetCode = async (phone: string, code: string) => {
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
    alert("Reset code verification failed: " + result.message);
    return false;
  }
};

export const updatePassword = async (
  newPassword: string,
  number: string,
  setUser: (user: any) => void
) => {
  const result = await API.put(
    PasswordUpdateEndpoint,
    {
      phone_number: number,
      new_password: newPassword,
    },
    false
  );
  if (result.isSuccess) {
    await SecureStore.setItemAsync("jwt", result.result.access_token);
    await createUserContext(setUser);
    return true;
  } else {
    alert("Password update failed: " + result.message);
    return false;
  }
};

const verifyCurrentPassword = async (email: string, password: string): Promise<boolean> => {
  const result = await API.post(
    AuthenticationEndpoint,
    {
      player_email: email,
      password: password,
    },
    false
  );

  return result.isSuccess;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  phoneNumber: string,
  setUser: (user: any) => void
) => {
  const token = await getToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const decodedToken = decodeToken(token);
  const currentUser = await dataAccess.getPlayerById(decodedToken?.sub);
  const userEmail = currentUser?.player_email;

  if (!userEmail) {
    throw new Error("Unable to retrieve user email for verification");
  }

  const isCurrentPasswordValid = await verifyCurrentPassword(userEmail, currentPassword);

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
      await SecureStore.setItemAsync("jwt", result.result.access_token);
    }
    await createUserContext(setUser);
    return { success: true, message: "Password changed successfully" };
  } else {
    return {
      success: false,
      message: result.message || "Password change failed",
    };
  }
};

export const createUserContext = async (setUser: (user: any) => void) => {
  const token = await getToken();
  if (!token) return;
  const decodedToken = decodeToken(token);
  const currentUser = await dataAccess.getPlayerById(decodedToken?.sub);
  setUser({
    player_id: currentUser.player_id,
    player_name: currentUser.player_name,
    player_mobile: currentUser.player_mobile,
    player_email: currentUser.player_email,
  });
};
