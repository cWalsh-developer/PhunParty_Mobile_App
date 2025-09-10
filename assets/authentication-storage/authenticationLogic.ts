import { AuthenticationEndpoint, SignUpEndpoint } from "@env";
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
  console.log(AuthenticationEndpoint);
  if (result.isSuccess && result.result?.access_token) {
    await SecureStore.setItemAsync("jwt", result.result.access_token);
    return true;
  } else {
    console.warn("Login failed:", result.message);
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
  console.log(SignUpEndpoint);
  console.log(result);
  if (result.isSuccess) {
    return true;
  } else {
    console.warn("Sign up failed:", result.message);
    return false;
  }
};
