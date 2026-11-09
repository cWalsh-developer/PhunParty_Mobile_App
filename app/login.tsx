import { UserContext } from "@/assets/authentication-storage/authContext";
import { login, resendEmailVerification, signUp } from "@/assets/authentication-storage/authenticationLogic";
import { getToken } from "@/assets/authentication-storage/authStorage";
import LoginForm from "@/components/LoginForm";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";

type AuthAction = "login" | "signup" | "resend" | null;

export default function Login() {
  const router = useRouter();
  const { setUser } = useContext(UserContext)!;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [action, setAction] = useState<AuthAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    getToken().then((token) => {
      if (token && active) router.replace("/(tabs)/scanQR");
    }).catch(() => {
      // A storage read failure should leave sign-in available.
    });
    return () => { active = false; };
  }, [router]);

  const clearFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const toggleForm = () => {
    if (pending.current) return;
    Keyboard.dismiss();
    setIsSignUp((previous) => isVerifyingEmail ? false : !previous);
    setIsVerifyingEmail(false);
    clearFeedback();
  };

  const perform = async (nextAction: Exclude<AuthAction, null>, operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setAction(nextAction);
    clearFeedback();
    Keyboard.dismiss();
    try {
      await operation();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      pending.current = false;
      setAction(null);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    await perform("login", async () => {
      const signedIn = await login({ email: email.trim(), password }, setUser);
      if (signedIn) router.replace("/(tabs)/scanQR");
      else setError("We couldn’t sign you in. Check your details and try again.");
    });
  };

  const handleSignUp = async (accepted: boolean) => {
    if (!accepted) {
      setError("Accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    if (!name.trim() || !email.trim() || !mobile.trim() || password.length < 8) {
      setError("Complete every field and use a password with at least 8 characters.");
      return;
    }
    await perform("signup", async () => {
      const created = await signUp({ name: name.trim(), email: email.trim(), password, mobile: mobile.trim() });
      if (created) {
        setEmail(email.trim());
        setIsVerifyingEmail(true);
        setNotice("Account created. Use the verification button in your email to finish signing up.");
      } else {
        setError("Your account could not be created. Review your details and try again.");
      }
    });
  };

  const handleResendVerification = async () => {
    await perform("resend", async () => {
      const sent = await resendEmailVerification(email.trim());
      if (sent) setNotice("Verification email sent. Check your inbox and spam folder.");
      else setError("The verification email could not be sent. Please try again.");
    });
  };

  return (
    <LoginForm
      email={email}
      setEmail={(value) => { setEmail(value); clearFeedback(); }}
      password={password}
      setPassword={(value) => { setPassword(value); clearFeedback(); }}
      name={name}
      setName={(value) => { setName(value); clearFeedback(); }}
      mobile={mobile}
      setMobile={(value) => { setMobile(value); clearFeedback(); }}
      isSignUp={isSignUp}
      isVerifyingEmail={isVerifyingEmail}
      toggleForm={toggleForm}
      handleLogin={handleLogin}
      handleSignUp={handleSignUp}
      handleResendVerification={handleResendVerification}
      handleReset={() => { if (!pending.current) router.push("/resetPassword"); }}
      setTermsAccepted={(value) => { setTermsAccepted(value); clearFeedback(); }}
      termsAccepted={termsAccepted}
      loading={action === "login" || action === "signup"}
      resending={action === "resend"}
      error={error}
      notice={notice}
    />
  );
}
