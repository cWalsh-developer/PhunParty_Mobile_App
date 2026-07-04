import { UserContext } from "@/assets/authentication-storage/authContext";
import {
  login,
  resendEmailVerification,
  signUp,
  verifyEmail,
} from "@/assets/authentication-storage/authenticationLogic";
import { getToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import LoginForm from "../components/LoginForm";

export default function Login() {
  //Initialisation----------------------------------------------------------------------------------
  const router = useRouter();

  //State--------------------------------------------------------------------------------------------
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState<boolean>(false);
  const { setUser } = useContext(UserContext)!;
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const token = await getToken();
      if (token) {
        router.replace("/(tabs)/scanQR");
      }
    };
    redirectIfAuthenticated();
  }, [isLoggedIn]);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const toggleForm = () => {
    setIsSignUp((prev) => !prev);
    setIsVerifyingEmail(false);
    setVerificationCode("");
  };

  //Handlers-----------------------------------------------------------------------------------------

  const handleLogin = async () => {
    const result = await login({ email, password }, setUser);
    if (result) {
      setIsLoggedIn(true);
    }
  };
  const handleSignUp = async (termsAccepted: boolean) => {
    setTermsAccepted(termsAccepted);
    if (!termsAccepted) {
      alert("You must accept the terms and conditions to sign up.");
      return;
    }
    const result = await signUp({ name, email, password, mobile });
    if (result) {
      setIsVerifyingEmail(true);
      alert("Account created. Check your email for your verification code.");
    }
  };

  const handleVerifyEmail = async () => {
    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      alert("Please enter the 6 digit verification code from your email.");
      return;
    }

    const verified = await verifyEmail({ email, code });
    if (!verified) return;

    const loggedIn = await login({ email, password }, setUser);
    if (loggedIn) {
      setIsLoggedIn(true);
    }
  };

  const handleResendVerification = async () => {
    const sent = await resendEmailVerification(email);
    if (sent) {
      alert("Verification code sent.");
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
      verificationCode={verificationCode}
      setVerificationCode={setVerificationCode}
      isSignUp={isSignUp}
      isVerifyingEmail={isVerifyingEmail}
      toggleForm={toggleForm}
      handleLogin={handleLogin}
      handleSignUp={handleSignUp}
      handleVerifyEmail={handleVerifyEmail}
      handleResendVerification={handleResendVerification}
      handleReset={handleReset}
      setTermsAccepted={setTermsAccepted}
      termsAccepted={termsAccepted}
    />
  );
}
