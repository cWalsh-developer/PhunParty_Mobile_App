import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export interface GameWebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export interface PlayerInfo {
  player_id: string;
  player_name: string;
  player_photo?: string;
}

export interface GameState {
  session_code: string;
  game_type: "trivia" | "buzzer" | "category" | string;
  is_active: boolean;
  current_question?: any;
}

export interface GameQuestion {
  question_id: string;
  question: string;
  options?: string[];
  display_options?: string[]; // Randomized options from backend
  correct_index?: number; // Index of correct answer in display_options
  answer?: string; // Original correct answer (for reference)
  game_type: string;
  ui_mode: "multiple_choice" | "buzzer" | "text_input";
}

export class GameWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;

  public isConnected = false;
  public sessionCode: string | null = null;
  public playerInfo: PlayerInfo | null = null;

  // Event callbacks
  public onConnectionStatusChange: ((connected: boolean) => void) | null = null;
  public onGameStateUpdate: ((gameState: GameState) => void) | null = null;
  public onQuestionReceived: ((question: GameQuestion) => void) | null = null;
  public onPlayerJoined: ((playerInfo: any) => void) | null = null;
  public onPlayerLeft: ((playerInfo: any) => void) | null = null;
  public onGameStarted: ((data: any) => void) | null = null;
  public onGameEnded: ((data: any) => void) | null = null;
  public onAnswerSubmitted: ((data: any) => void) | null = null;
  public onBuzzerUpdate: ((data: any) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  private getWebSocketUrl(): string {
    // Try multiple possible API URL configurations
    const baseUrl =
      Constants.expoConfig?.extra?.API_BASE_URL ||
      Constants.expoConfig?.extra?.API_URL ||
      "https://api.phun.party";



    // Convert HTTP(S) to WebSocket URL
    let wsUrl;
    if (baseUrl.startsWith("https://")) {
      wsUrl = baseUrl.replace(/^https:\/\//, "wss://");
    } else if (baseUrl.startsWith("http://")) {
      wsUrl = baseUrl.replace(/^http:\/\//, "ws://");
    } else {
      // Assume HTTPS by default
      wsUrl = `wss://${baseUrl.replace(/^\/+/, "")}`;
    }


    return wsUrl;
  }

  async connect(sessionCode: string, playerInfo: PlayerInfo): Promise<boolean> {
    if (this.ws && this.isConnected) {
      this.disconnect();
    }

    // Validate inputs
    if (!sessionCode || sessionCode.trim().length === 0) {

      this.onError?.("Invalid session code. Please scan a valid game QR code.");
      return false;
    }

    if (!playerInfo || !playerInfo.player_name || !playerInfo.player_id) {

      this.onError?.("Invalid player information. Please check your profile.");
      return false;
    }

    this.sessionCode = sessionCode;
    this.playerInfo = playerInfo;

    console.log(
      `Connecting to session: ${sessionCode} as player: ${playerInfo.player_name}`
    );

    try {
      // First, ensure player is properly joined to the session via API
      const API = (await import("./API")).default;


      const joinResponse = await API.gameSession.join(
        sessionCode,
        playerInfo.player_id
      );

      console.log("Join response:", {
        isSuccess: joinResponse.isSuccess,
        message: joinResponse.message,
      });

      let joinSuccessful = false;

      if (!joinResponse.isSuccess) {
        // Check for specific error cases
        const errorMsg = joinResponse.message?.toLowerCase() || "";

        if (
          errorMsg.includes("already in a game session") ||
          errorMsg.includes("already in session")
        ) {
          // Player is already in a session - check if we can get session info to verify
          console.log(
            "ℹ️ Backend reports player already in a session, verifying..."
          );

          // First check if player is in THIS session by trying to get session info
          try {
            const joinInfoResponse = await API.gameSession.getJoinInfo(
              sessionCode
            );

            if (joinInfoResponse.isSuccess) {
              // Session exists and we can get info - player might already be in it
              console.log(
                "✅ Session is accessible, player likely already joined - continuing"
              );
              joinSuccessful = true;
            } else {
              // Can't get session info - try to leave and retry
              console.log(
                "⚠️ Cannot access session, attempting to leave previous session..."
              );

              const dataAccess = (
                await import("../../databaseAccess/dataAccess")
              ).default;
              const leaveResult = await dataAccess.leaveGameSession(
                playerInfo.player_id
              );

              if (leaveResult) {


                // Retry the join after leaving
                const retryJoinResponse = await API.gameSession.join(
                  sessionCode,
                  playerInfo.player_id
                );

                if (retryJoinResponse.isSuccess) {
                  console.log(
                    "✅ Successfully joined after leaving previous session"
                  );
                  joinSuccessful = true;
                } else {
                  console.log(
                    "ℹ️ Retry join returned error, but continuing to attempt connection"
                  );
                  joinSuccessful = true; // Continue anyway - WebSocket might still work
                }
              } else {
                console.log(
                  "ℹ️ Leave operation unsuccessful, but continuing to attempt connection"
                );
                joinSuccessful = true; // Continue anyway
              }
            }
          } catch (verifyError: any) {
            console.log(
              "ℹ️ Could not verify session state, continuing to attempt connection"
            );
            joinSuccessful = true; // Continue anyway
          }
        } else if (errorMsg === "unable to join game") {
          // Generic error - this might mean player is already in session
          // Let's try to continue anyway and see if we can get session info

          console.warn(
            "This might mean player is already in session - attempting to continue..."
          );

          joinSuccessful = true; // Attempt to continue
        } else if (
          errorMsg.includes("not found") ||
          errorMsg.includes("does not exist")
        ) {
          const error = `Game session "${sessionCode}" not found. The session may have ended or the code is invalid.`;

          this.onError?.(error);
          return false;
        } else if (errorMsg.includes("full") || errorMsg.includes("maximum")) {
          const error = "Game session is full. Cannot join.";

          this.onError?.(error);
          return false;
        } else if (
          errorMsg.includes("started") ||
          errorMsg.includes("in progress")
        ) {
          const error = "Game has already started. Cannot join at this time.";

          this.onError?.(error);
          return false;
        } else {
          const error = `Unable to join game: ${
            joinResponse.message || "Unknown error"
          }`;


          this.onError?.(error);
          return false;
        }
      } else {

        joinSuccessful = true;
      }

      if (joinSuccessful) {

      }

      // Get session join info to get the correct WebSocket URL

      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);

      console.log("Join info response:", {
        isSuccess: joinInfoResponse.isSuccess,
        hasResult: !!joinInfoResponse.result,
      });

      if (!joinInfoResponse.isSuccess) {
        const error = `Could not get session info: ${
          joinInfoResponse.message || "Unknown error"
        }`;

        this.onError?.(error);
        return false;
      }

      if (!joinInfoResponse.result) {
        const error = "Session info is empty. The session may be invalid.";

        this.onError?.(error);
        return false;
      }

      const sessionInfo = joinInfoResponse.result;
      console.log("Session info received:", {
        session_code: sessionInfo.session_code,
        host_name: sessionInfo.host_name,
        has_websocket_url: !!sessionInfo.websocket_url,
      });

      // Use the WebSocket URL provided by the backend
      let wsUrl = sessionInfo.websocket_url;

      // If we don't have a specific websocket URL from backend, construct one
      if (!wsUrl) {
        const baseUrl = this.getWebSocketUrl();
        wsUrl = `${baseUrl}/ws/session/${sessionCode}`;
      }

      // Try multiple authentication methods based on your backend dependencies
      const token = await SecureStore.getItemAsync("jwt");
      const apiKey = Constants.expoConfig?.extra?.API_KEY;

      console.log("Authentication check:", {
        hasToken: !!token,
        hasApiKey: !!apiKey,
        tokenLength: token?.length,
      });

      // Build query parameters - based on your backend get_api_key dependency
      const params = new URLSearchParams();

      // Add API key for get_api_key dependency (required by your backend routes)
      if (apiKey) {
        params.append("api_key", apiKey);

      }

      // Add additional parameters
      params.append("client_type", "mobile");
      params.append("player_id", playerInfo.player_id);
      params.append("player_name", playerInfo.player_name);

      if (playerInfo.player_photo) {
        params.append("player_photo", playerInfo.player_photo);
      }

      const finalWsUrl = `${wsUrl}?${params.toString()}`;
      console.log(
        "Final WebSocket URL:",
        finalWsUrl.replace(/(api_key|token)=[^&]+/g, "$1=***")
      );

      this.ws = new WebSocket(finalWsUrl);

      this.ws.onopen = () => {

        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionStatusChange?.(true);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: GameWebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {

        }
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });

        // Log specific error codes for debugging
        if (event.code === 1006) {
          console.error(
            "WebSocket closed unexpectedly (1006). Possible causes:"
          );
          console.error(
            "- Server rejected connection (authentication failure)"
          );



        } else if (event.code === 1002) {
          console.error(
            "WebSocket protocol error (1002) - Invalid request format"
          );
        } else if (event.code === 1003) {

        } else if (event.code === 1011) {
          console.error(
            "WebSocket server error (1011) - Internal server error"
          );
        }

        this.isConnected = false;
        this.onConnectionStatusChange?.(false);
        this.stopHeartbeat();

        // Auto-reconnect unless it was a deliberate disconnect
        if (
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          console.log(
            `Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${
              this.maxReconnectAttempts
            }`
          );
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {


        // Provide more specific error guidance
        this.onError?.(
          "Connection failed. Please ensure you've joined the session properly and have a stable internet connection."
        );
      };

      return true;
    } catch (error: any) {

      console.error("Connection error details:", {
        name: error.name,
        message: error.message,
        sessionCode,
        playerId: playerInfo.player_id,
      });

      // Provide user-friendly error messages based on error type
      let userMessage = "Failed to connect";

      if (error.message) {
        if (
          error.message.includes("Network request failed") ||
          error.message.includes("Unable to connect")
        ) {
          userMessage =
            "Network error. Please check your internet connection and try again.";
        } else if (error.message.includes("timeout")) {
          userMessage =
            "Connection timeout. Please check your internet connection and try again.";
        } else if (
          error.message.includes("not found") ||
          error.message.includes("does not exist")
        ) {
          userMessage = `Game session "${sessionCode}" not found. The session may have ended.`;
        } else {
          userMessage = `Failed to connect: ${error.message}`;
        }
      }

      this.onError?.(userMessage);
      return false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, "User disconnect");
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionCode = null;
    this.playerInfo = null;
    this.onConnectionStatusChange?.(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.sessionCode && this.playerInfo) {
        console.log(
          `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect(this.sessionCode, this.playerInfo);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.sendMessage({ type: "ping" });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: GameWebSocketMessage): void {
    console.log("🔔 WebSocket message received:", {
      type: message.type,
      hasData: !!message.data,
      timestamp: message.timestamp || Date.now(),
    });

    switch (message.type) {
      case "initial_state":

        this.handleInitialState(message.data);
        break;

      case "question_started":
      case "new_question":
      case "question_update":
      case "next_question":
      case "question_changed":
      case "current_question":
      case "question":
      case "quiz_started":
      case "start_quiz":
        console.log(
          "🎯 Question/Quiz event received:",
          message.type,
          message.data
        );
        if (message.data) {
          this.onQuestionReceived?.(message.data);
        } else {
          console.warn(
            "⚠️ Question event received but no data - triggering fetch"
          );
          // Trigger a manual question fetch if no data in WebSocket event
          this.onQuestionReceived?.({
            question_id: "",
            question: "",
            game_type: "trivia",
            ui_mode: "multiple_choice",
          });
        }
        break;

      case "player_joined":

        this.onPlayerJoined?.(message.data);
        break;

      case "player_left":

        this.onPlayerLeft?.(message.data);
        break;

      case "game_started":
      case "quiz_started":
      case "start_game":
      case "begin_quiz":

        this.onGameStarted?.(message.data);
        break;

      case "game_ended":

        this.onGameEnded?.(message.data);
        break;

      case "answer_submitted":

        this.onAnswerSubmitted?.(message.data);
        break;

      case "ui_update":
      case "buzzer_winner":
      case "correct_answer":
      case "incorrect_answer":

        this.onBuzzerUpdate?.(message.data);
        break;

      case "pong":
        // Heartbeat response - do nothing but log

        break;

      case "error":

        this.onError?.(message.data?.message || "An error occurred");
        break;

      default:

    }
  }

  private handleInitialState(data: any): void {


    if (data.game_state) {

      this.onGameStateUpdate?.(data.game_state);
    }

    if (data.current_question) {

      this.onQuestionReceived?.(data.current_question);
    } else if (data.question) {

      this.onQuestionReceived?.(data.question);
    }
  }

  sendMessage(message: GameWebSocketMessage): boolean {
    if (!this.isConnected || !this.ws) {

      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {

      return false;
    }
  }

  // Game-specific message senders
  submitAnswer(answer: string, questionId: string): boolean {
    return this.sendMessage({
      type: "submit_answer",
      data: {
        answer,
        question_id: questionId,
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
  }

  pressBuzzer(): boolean {
    return this.sendMessage({
      type: "buzzer_press",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
  }

  requestSessionStats(): boolean {
    return this.sendMessage({
      type: "get_session_stats",
      data: {
        session_code: this.sessionCode,
      },
    });
  }

  // HTTP API integrations for when WebSocket is not available
  async submitAnswerViaAPI(questionId: string, answer: string): Promise<any> {
    try {
      if (!this.sessionCode || !this.playerInfo?.player_id) {

        return {
          isSuccess: false,
          message: "Not connected to a session",
        };
      }

      if (!questionId || !answer) {

        return {
          isSuccess: false,
          message: "Invalid question or answer",
        };
      }

      const API = (await import("./API")).default;
      return await API.gameSession.submitAnswer(
        this.sessionCode,
        this.playerInfo.player_id,
        questionId,
        answer
      );
    } catch (error: any) {

      return {
        isSuccess: false,
        message: error.message || "Failed to submit answer",
      };
    }
  }

  async getSessionStatus(): Promise<any> {
    try {
      if (!this.sessionCode) {

        return {
          isSuccess: false,
          message: "Not connected to a session",
        };
      }

      const API = (await import("./API")).default;
      return await API.gameSession.getStatus(this.sessionCode);
    } catch (error: any) {

      return {
        isSuccess: false,
        message: error.message || "Failed to get session status",
      };
    }
  }

  async getCurrentQuestion(): Promise<any> {
    try {
      if (!this.sessionCode) {

        return {
          isSuccess: false,
          message: "Not connected to a session",
        };
      }

      const API = (await import("./API")).default;
      return await API.gameSession.getCurrentQuestion(this.sessionCode);
    } catch (error: any) {

      return {
        isSuccess: false,
        message: error.message || "Failed to get current question",
      };
    }
  }
}

// Global instance
export const gameWebSocket = new GameWebSocketService();
