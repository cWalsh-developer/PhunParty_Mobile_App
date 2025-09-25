import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useState,
} from "react";

interface UserType {
  player_id: string | null;
  player_name: string | null;
  player_mobile: string | null;
  player_email: string | null;
  profile_photo_url: string | null;
}

interface UserContextType {
  user: UserType;
  setUser: Dispatch<SetStateAction<UserType>>;
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined
);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType>({
    player_id: null,
    player_name: null,
    player_mobile: null,
    player_email: null,
    profile_photo_url: null,
  });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
