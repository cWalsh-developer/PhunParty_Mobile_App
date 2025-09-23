import {
  resetPassword,
  verifyResetCode,
} from "@/assets/authentication-storage/authenticationLogic";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import ResetPasswordForm from "./components/ResetPasswordForm";

export default function ResetPassword() {
  const [phone, setPhone] = useState<string>("");
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const router = useRouter();

  const handleReset = async () => {
    if (!isPressed) {
      const result = await resetPassword(phone);
      if (result) {
        setIsPressed(true);
      }
    }
  };

  const handleVerifyCode = async () => {
    const result = await verifyResetCode(phone, code);
    if (result) {
      setIsSuccess(true);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      router.replace({ pathname: "/newPassword", params: { phone } });
    }
  }, [isSuccess]);

  return (
    <ResetPasswordForm
      phone={phone}
      setPhone={setPhone}
      code={code}
      setCode={setCode}
      isPressed={isPressed}
      onReset={handleReset}
      onVerify={handleVerifyCode}
    />
  );
}
