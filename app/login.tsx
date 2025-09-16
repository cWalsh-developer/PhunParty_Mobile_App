import { UserContext } from "@/assets/authentication-storage/authContext";
import {
  login,
  signUp,
} from "@/assets/authentication-storage/authenticationLogic";
import {
  decodeToken,
  getToken,
} from "@/assets/authentication-storage/authStorage";
import dataAccess from "@/databaseAccess/dataAccess";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";

export default function Login() {
  //Initialisation----------------------------------------------------------------------------------
  const { setUser } = useContext(UserContext)!;
  const router = useRouter();

  //State--------------------------------------------------------------------------------------------
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");

  useEffect(() => {
    const createUserContext = async () => {
      const token = await getToken();
      if (!token) return;
      const decodedToken = decodeToken(token);
      const currentUser = await dataAccess.getPlayerById(decodedToken?.sub);
      setUser({
        UserID: currentUser.player_id,
        UserName: currentUser.player_name,
        UserPhone: currentUser.player_mobile,
        UserEmail: currentUser.player_email,
      });
    };
    const redirectIfAuthenticated = async () => {
      const token = await getToken();
      if (token) {
        router.replace("/(tabs)/scanQR");
      }
    };
    createUserContext();
    redirectIfAuthenticated();
  }, [isLoggedIn]);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const toggleForm = () => {
    setIsSignUp((prev) => !prev);
  };

  //Handlers-----------------------------------------------------------------------------------------

  const handleLogin = async () => {
    const result = await login({ email, password });
    if (result) {
      setIsLoggedIn(true);
    }
  };
  const handleSignUp = async () => {
    const result = await signUp({ name, email, password, mobile });
    if (result) {
      toggleForm();
    }
  };

  const handleReset = () => {
    router.push("/resetPassword");
  };
  //View---------------------------------------------------------------------------------------------
  return (
    <LoginForm
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      name={name}
      setName={setName}
      mobile={mobile}
      setMobile={setMobile}
      isSignUp={isSignUp}
      toggleForm={toggleForm}
      handleLogin={handleLogin}
      handleSignUp={handleSignUp}
      handleReset={handleReset}
    />
  );
}
