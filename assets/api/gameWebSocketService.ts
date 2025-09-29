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

    console.log("Base API URL:", baseUrl);

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

    console.log("WebSocket URL base:", wsUrl);
    return wsUrl;
  }

  async connect(sessionCode: string, playerInfo: PlayerInfo): Promise<boolean> {
    if (this.ws && this.isConnected) {
      this.disconnect();
    }

    // Validate inputs
    if (!sessionCode || sessionCode.trim().length === 0) {
      console.error("Invalid session code provided:", sessionCode);
      this.onError?.("Invalid session code. Please scan a valid game QR code.");
      return false;
    }

    if (!playerInfo || !playerInfo.player_name || !playerInfo.player_id) {
      console.error("Invalid player info provided:", playerInfo);
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

      console.log("Ensuring player is joined to session via API...");
      const joinResponse = await API.gameSession.join(
        sessionCode,
        playerInfo.player_id
      );

      if (!joinResponse.isSuccess) {
        // If already joined, that's fine - continue
        if (!joinResponse.message?.includes("already in a game session")) {
          throw new Error(joinResponse.message || "Failed to join session");
        }
        console.log(
          "Player already in session, proceeding to WebSocket connection"
        );
      } else {
        console.log("Successfully joined session via API");
      }

      // Get session join info to get the correct WebSocket URL
      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);
      if (!joinInfoResponse.isSuccess) {
        throw new Error(
          joinInfoResponse.message || "Could not get session info"
        );
      }

      const sessionInfo = joinInfoResponse.result;
      console.log("Session info:", sessionInfo);

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
        console.log("Using API key authentication for WebSocket");
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
        console.log(`WebSocket connected to session ${sessionCode}`);
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
          console.error("Error parsing WebSocket message:", error);
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
          console.error("- Session does not exist or expired");
          console.error("- Player not properly joined to session");
          console.error("- Backend dependency check failed (API key required)");
        } else if (event.code === 1002) {
          console.error(
            "WebSocket protocol error (1002) - Invalid request format"
          );
        } else if (event.code === 1003) {
          console.error("WebSocket unsupported data (1003)");
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
        console.error("WebSocket error:", error);

        // Provide more specific error guidance
        this.onError?.(
          "Connection failed. Please ensure you've joined the session properly and have a stable internet connection."
        );
      };

      return true;
    } catch (error: any) {
      console.error("Error connecting to WebSocket:", error);
      this.onError?.(`Failed to connect: ${error.message}`);
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
        console.log("📊 Initial state received");
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
        console.log("👋 Player joined:", message.data);
        this.onPlayerJoined?.(message.data);
        break;

      case "player_left":
        console.log("👋 Player left:", message.data);
        this.onPlayerLeft?.(message.data);
        break;

      case "game_started":
      case "quiz_started":
      case "start_game":
      case "begin_quiz":
        console.log("🎮 Game/Quiz started event:", message.type, message.data);
        this.onGameStarted?.(message.data);
        break;

      case "game_ended":
        console.log("🏁 Game ended:", message.data);
        this.onGameEnded?.(message.data);
        break;

      case "answer_submitted":
        console.log("✅ Answer submitted:", message.data);
        this.onAnswerSubmitted?.(message.data);
        break;

      case "ui_update":
      case "buzzer_winner":
      case "correct_answer":
      case "incorrect_answer":
        console.log("🎯 Buzzer/UI update:", message.type, message.data);
        this.onBuzzerUpdate?.(message.data);
        break;

      case "pong":
        // Heartbeat response - do nothing but log
        console.log("💓 Heartbeat pong received");
        break;

      case "error":
        console.error("❌ WebSocket error message:", message.data);
        this.onError?.(message.data?.message || "An error occurred");
        break;

      default:
        console.log("❓ Unknown message type:", message.type, message.data);
    }
  }

  private handleInitialState(data: any): void {
    console.log("📊 Handling initial state:", data);

    if (data.game_state) {
      console.log("🎮 Setting game state from initial state");
      this.onGameStateUpdate?.(data.game_state);
    }

    if (data.current_question) {
      console.log("🎯 Setting current question from initial state");
      this.onQuestionReceived?.(data.current_question);
    } else if (data.question) {
      console.log("🎯 Setting question from initial state (alt format)");
      this.onQuestionReceived?.(data.question);
    }
  }

  sendMessage(message: GameWebSocketMessage): boolean {
    if (!this.isConnected || !this.ws) {
      console.warn("Cannot send message: WebSocket not connected");
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
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
    if (!this.sessionCode || !this.playerInfo?.player_id) {
      throw new Error("Not connected to a session");
    }

    const API = (await import("./API")).default;
    return await API.gameSession.submitAnswer(
      this.sessionCode,
      this.playerInfo.player_id,
      questionId,
      answer
    );
  }

  async getSessionStatus(): Promise<any> {
    if (!this.sessionCode) {
      throw new Error("Not connected to a session");
    }

    const API = (await import("./API")).default;
    return await API.gameSession.getStatus(this.sessionCode);
  }

  async getCurrentQuestion(): Promise<any> {
    if (!this.sessionCode) {
      throw new Error("Not connected to a session");
    }

    const API = (await import("./API")).default;
    return await API.gameSession.getCurrentQuestion(this.sessionCode);
  }
}

// Global instance
export const gameWebSocket = new GameWebSocketService();
