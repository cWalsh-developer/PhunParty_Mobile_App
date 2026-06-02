import { UserContext } from "@/assets/authentication-storage/authContext";
import FriendsScreen from "@/components/FriendsScreen";
import { useContext } from "react";

export default function FriendsTab() {
  const { user } = useContext(UserContext)!;

  return <FriendsScreen playerId={user?.player_id} />;
}
