import { UserContext } from "@/assets/authentication-storage/authContext";
import { updatePassword } from "@/assets/authentication-storage/authenticationLogic";
import NewPasswordForm from "@/components/NewPasswordForm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useRef, useState } from "react";
import { Keyboard } from "react-native";

export default function NewPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const router = useRouter();
  const { setUser } = useContext(UserContext)!;
  const pending = useRef(false);

  const handleSetNewPassword = async () => {
    if (pending.current) return;
    if (!phone) {
      setError("Your reset session is missing. Request a new reset code to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords don’t match. Enter the same password in both fields.");
      return;
    }
    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const updated = await updatePassword(password, phone, setUser);
      if (updated) router.replace("/(tabs)/scanQR");
      else setError("Your password could not be saved. Try again, or request a new reset code.");
    } catch {
      setError("Check your connection, then try saving your password again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <NewPasswordForm
      password={password}
      confirmPassword={confirmPassword}
      onPasswordChange={(value) => { setPassword(value); setError(null); }}
      onConfirmPasswordChange={(value) => { setConfirmPassword(value); setError(null); }}
      onSubmit={handleSetNewPassword}
      loading={loading}
      error={phone ? error : "Your reset session is missing. Request a new reset code to continue."}
      disabled={!phone}
    />
  );
}
