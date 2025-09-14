import {
  AuthenticationEndpoint,
  PasswordResetEndpoint,
  PasswordResetVerificationEndpoint,
  SignUpEndpoint,
} from "@env";
import * as SecureStore from "expo-secure-store";
import API from "../api/API";

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

export const login = async ({
  email,
  password,
}: LoginRequest): Promise<boolean> => {
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
    console.log(result);
    console.log(phone);
    console.log(PasswordResetEndpoint);
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
