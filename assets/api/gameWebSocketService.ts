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
    const wsUrl = baseUrl.replace(/^https?:\/\//, "wss://");
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
    console.log("Base URL for WebSocket:", this.getWebSocketUrl());

    // Test if the WebSocket endpoint is reachable
    try {
      const testUrl = this.getWebSocketUrl().replace("wss://", "https://");
      console.log("Testing HTTP endpoint accessibility:", testUrl);

      // Create timeout promise
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      const fetchPromise = fetch(`${testUrl}/health`, {
        method: "GET",
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]).catch(
        () => null
      );

      if (response) {
        console.log(
          "HTTP endpoint is reachable, status:",
          (response as Response).status
        );
      } else {
        console.warn(
          "HTTP endpoint test failed - continuing with WebSocket attempt"
        );
      }
    } catch (error) {
      console.warn("Endpoint test failed:", error);
    }

    try {
      // Try both JWT token and API key for authentication
      const token = await SecureStore.getItemAsync("jwt");
      const apiKey = Constants.expoConfig?.extra?.API_KEY;

      console.log("Authentication check:", {
        hasToken: !!token,
        hasApiKey: !!apiKey,
        tokenLength: token?.length,
      });

      // Build the WebSocket URL with different auth approaches
      const baseWsUrl = `${this.getWebSocketUrl()}/ws/session/${sessionCode}`;
      const params = new URLSearchParams({
        client_type: "mobile",
        player_id: playerInfo.player_id,
        player_name: playerInfo.player_name,
      });

      // Add player photo if available
      if (playerInfo.player_photo) {
        params.append("player_photo", playerInfo.player_photo);
      }

      // Try JWT token first, then API key, then no auth
      if (token) {
        params.append("token", token);
        console.log("Using JWT token authentication");
      } else if (apiKey) {
        params.append("api_key", apiKey);
        console.log("Using API key authentication");
      } else {
        console.warn(
          "No authentication method available - attempting unauthenticated connection"
        );
      }

      const wsUrl = `${baseWsUrl}?${params.toString()}`;
      console.log(
        "Final WebSocket URL:",
        wsUrl.replace(/(token|api_key)=[^&]+/g, "$1=***")
      );

      this.ws = new WebSocket(wsUrl);

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
          url: this.ws?.url?.replace(/(token|api_key)=[^&]+/g, "$1=***"),
        });

        // Log specific error codes for debugging
        if (event.code === 1006) {
          console.error("WebSocket closed unexpectedly (1006). Common causes:");
          console.error(
            "- Server rejected connection (wrong endpoint, auth failure)"
          );
          console.error("- Network/CORS issues");
          console.error("- Server not responding");
          console.error("- Invalid session code:", this.sessionCode);
        } else if (event.code === 1002) {
          console.error(
            "WebSocket protocol error (1002) - Server rejected the connection"
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

        // Provide more specific error messages based on common issues
        const token = this.ws?.url?.includes("token=");
        if (!token) {
          this.onError?.("Authentication required. Please login first.");
        } else {
          this.onError?.(
            "Connection error occurred. Please check your network and try again."
          );
        }
      };

      return true;
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.onError?.("Failed to connect to game session");
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
    console.log("WebSocket message received:", message.type);

    switch (message.type) {
      case "initial_state":
        this.handleInitialState(message.data);
        break;

      case "question_started":
        this.onQuestionReceived?.(message.data);
        break;

      case "player_joined":
        this.onPlayerJoined?.(message.data);
        break;

      case "player_left":
        this.onPlayerLeft?.(message.data);
        break;

      case "game_started":
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
        // Heartbeat response - do nothing
        break;

      case "error":
        this.onError?.(message.data?.message || "An error occurred");
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  private handleInitialState(data: any): void {
    if (data.game_state) {
      this.onGameStateUpdate?.(data.game_state);
    }

    if (data.current_question) {
      this.onQuestionReceived?.(data.current_question);
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
      },
    });
  }

  pressBuzzer(): boolean {
    return this.sendMessage({
      type: "buzzer_press",
    });
  }

  requestSessionStats(): boolean {
    return this.sendMessage({
      type: "get_session_stats",
    });
  }
}

// Global instance
export const gameWebSocket = new GameWebSocketService();
