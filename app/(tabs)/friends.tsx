import { UserContext } from "@/assets/authentication-storage/authContext";
import FriendsScreen from "@/components/FriendsScreen";
import { useRouter } from "expo-router";
import { useContext } from "react";

export default function FriendsTab() {
  const router = useRouter();
  const { user, setUser } = useContext(UserContext)!;

  const handleAuthInvalid = () => {
    setUser({
      player_id: null,
      player_name: null,
      player_mobile: null,
      player_email: null,
      profile_photo_url: null,
      active_game_code: null,
    });
    router.replace("/login");
  };

  return (
    <FriendsScreen
      playerId={user?.player_id}
      onAuthInvalid={handleAuthInvalid}
    />
  );
}
