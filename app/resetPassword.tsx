import { resetPassword, verifyResetCode } from "@/assets/authentication-storage/authenticationLogic";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard } from "react-native";

export default function ResetPassword() {
  const [phone, setPhone] = useState("");
  const [isPressed, setIsPressed] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const router = useRouter();

  const handleReset = async () => {
    if (pending.current || isPressed) return;
    if (phone.trim().length < 11) {
      setError("Enter the full mobile number on your account.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const sent = await resetPassword(phone.trim());
      if (sent) {
        setPhone(phone.trim());
        setIsPressed(true);
      } else {
        setError("The reset code could not be sent. Check your number and try again.");
      }
    } catch {
      setError("Check your connection, then try sending the code again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (pending.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your message.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const verified = await verifyResetCode(phone, code);
      if (verified) router.replace({ pathname: "/newPassword", params: { phone } });
      else setError("That code could not be verified. Check the message and try again.");
    } catch {
      setError("Check your connection, then try verifying the code again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  return (
    <ResetPasswordForm
      phone={phone}
      setPhone={(value) => { setPhone(value); setError(null); }}
      code={code}
      setCode={(value) => { setCode(value); setError(null); }}
      isPressed={isPressed}
      onReset={handleReset}
      onVerify={handleVerifyCode}
      loading={loading}
      error={error}
      onChangePhone={() => {
        if (pending.current) return;
        setIsPressed(false);
        setCode("");
        setError(null);
      }}
    />
  );
}
