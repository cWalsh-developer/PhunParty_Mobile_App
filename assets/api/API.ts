//Imports
import Constants from "expo-constants";
import { getToken } from "../authentication-storage/authStorage";

// Define API result shape
interface APIResponse<T = any> {
  isSuccess: boolean;
  result?: T;
  message?: string;
}

type DataObject = Record<string, any>;

const API = {
  get: <T = any>(endpoint: string, withAuth: boolean = true) =>
    callFetch<T>(endpoint, "GET", null, withAuth),
  post: <T = any>(
    endpoint: string,
    data?: DataObject,
    withAuth: boolean = true
  ) => callFetch<T>(endpoint, "POST", data, withAuth),
  put: <T = any>(
    endpoint: string,
    data?: DataObject,
    withAuth: boolean = true
  ) => callFetch<T>(endpoint, "PUT", data, withAuth),
  delete: <T = any>(endpoint: string, withAuth: boolean = true) =>
    callFetch<T>(endpoint, "DELETE", null, withAuth),

  // Game Session Management
  gameSession: {
    // Join a game session
    join: (sessionCode: string, playerId: string) =>
      callFetch("/game/join", "POST", {
        session_code: sessionCode,
        player_id: playerId,
      }),

    // Get session join information (includes WebSocket URL)
    getJoinInfo: (sessionCode: string) =>
      callFetch(`/game/session/${sessionCode}/join-info`, "GET"),

    // Get current game session status
    getStatus: (sessionCode: string) =>
      callFetch(`/game-logic/status/${sessionCode}`, "GET"),

    // Get current question for session
    getCurrentQuestion: (sessionCode: string) =>
      callFetch(`/game-logic/current-question/${sessionCode}`, "GET"),

    // Submit player answer
    submitAnswer: (
      sessionCode: string,
      playerId: string,
      questionId: string,
      playerAnswer: string
    ) =>
      callFetch("/game-logic/submit-answer", "POST", {
        session_code: sessionCode,
        player_id: playerId,
        question_id: questionId,
        player_answer: playerAnswer,
      }),
  },

  // Game Management
  game: {
    // Get game details by game code
    getByCode: (gameCode: string) => callFetch(`/game/${gameCode}`, "GET"),

    // Get all available games
    getAll: () => callFetch("/game", "GET"),

    // Create new game
    create: (rules: string, genre: string) =>
      callFetch("/game", "POST", { rules, genre }),

    // Create game session
    createSession: (
      hostName: string,
      numberOfQuestions: number,
      gameCode: string,
      ownerPlayerId: string
    ) =>
      callFetch("/game/create/session", "POST", {
        host_name: hostName,
        number_of_questions: numberOfQuestions,
        game_code: gameCode,
        owner_player_id: ownerPlayerId,
      }),
  },
};

export default API;

// Core fetch function
const callFetch = async <T = any>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  dataObj: DataObject | null = null,
  withAuth: boolean = true
): Promise<APIResponse<T>> => {
  const apiKey = Constants.expoConfig?.extra?.API_KEY || "";

  const headers: HeadersInit = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };

  // Add Authorization header if token exists
  if (withAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Use endpoint directly if it's a full URL, otherwise combine with base URL
  const baseUrl = Constants.expoConfig?.extra?.API_URL;
  const url = endpoint.startsWith("https")
    ? endpoint
    : baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
    : endpoint;

  const requestObj: RequestInit = {
    method,
    headers,
    ...(dataObj && { body: JSON.stringify(dataObj) }),
  };

  try {
    const response = await fetch(url, requestObj);

    // Handle network errors
    if (!response) {
      return {
        isSuccess: false,
        message: "Network error: No response received from server",
      };
    }

    // Handle response parsing
    let result = null;
    if (response.status !== 204) {
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : null;
      } catch (parseError: any) {
        console.error("Failed to parse response:", parseError);
        return {
          isSuccess: false,
          message: `Invalid response format: ${parseError.message}`,
        };
      }
    }

    return response.ok
      ? { isSuccess: true, result }
      : {
          isSuccess: false,
          message:
            result?.detail ||
            result?.message ||
            JSON.stringify(result) ||
            `Request failed with status ${response.status}`,
        };
  } catch (error: any) {
    console.error("API request error:", error);

    // Handle specific error types
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        isSuccess: false,
        message: "Network error: Unable to connect to server",
      };
    }

    if (error.name === "AbortError") {
      return { isSuccess: false, message: "Request timeout" };
    }

    return {
      isSuccess: false,
      message: error.message || "An unexpected error occurred",
    };
  }
};
