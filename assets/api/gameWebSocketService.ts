import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export interface GameWebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number | string;
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
  start_at?: string; // ISO timestamp for synchronized display
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export class GameWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private connectionState: ConnectionState = "disconnected";
  private clockOffset: number = 0; // ms offset from server time for synchronized reveals
  private wsId: string | null = null; // WebSocket ID from backend

  // Heartbeat health tracking
  private lastPongReceived: number = Date.now();
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds - disconnect if no pong received

  // Connection deduplication tracking
  private isConnecting: boolean = false; // Prevent simultaneous connection attempts
  private connectionAttemptCount: number = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  private readonly ATTEMPT_RESET_MS = 5000; // Reset counter after 5 seconds
  private lastAttemptTime: number = 0;
  private shouldReconnect: boolean = true; // Flag to control reconnection behavior

  public isConnected = false;
  public sessionCode: string | null = null;
  public playerInfo: PlayerInfo | null = null;

  // Message buffers to hold events that arrive before handlers are ready
  private pendingQuestions: GameQuestion[] = [];
  private pendingGameStarted: any[] = [];
  private isReadyForQuestions: boolean = false; // Track if UI is ready to display questions
  private waitingForQueueResponse: boolean = false; // Track if we requested question from queue

  // Private callback storage
  private _onQuestionReceived: ((question: GameQuestion) => void) | null = null;
  private _onGameStarted: ((data: any) => void) | null = null;

  // Event callbacks
  public onConnectionStatusChange: ((connected: boolean) => void) | null = null;
  public onConnectionStateChange: ((state: ConnectionState) => void) | null =
    null;
  public onGameStateUpdate: ((gameState: GameState) => void) | null = null;
  public onPlayerJoined: ((playerInfo: any) => void) | null = null;
  public onPlayerLeft: ((playerInfo: any) => void) | null = null;
  public onGameEnded: ((data: any) => void) | null = null;
  public onAnswerSubmitted: ((data: any) => void) | null = null;
  public onBuzzerUpdate: ((data: any) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  // Buffered callback setters/getters
  public set onQuestionReceived(
    handler: ((question: GameQuestion) => void) | null
  ) {
    console.log("📝 Setting onQuestionReceived handler", {
      hadHandler: !!this._onQuestionReceived,
      hasNewHandler: !!handler,
      pendingCount: this.pendingQuestions.length,
    });

    this._onQuestionReceived = handler;

    // Deliver buffered questions ONLY if UI is ready
    if (
      handler &&
      this.pendingQuestions.length > 0 &&
      this.isReadyForQuestions
    ) {
      console.log(
        `📬 Delivering ${this.pendingQuestions.length} buffered questions (handler set, UI ready)`
      );
      const buffered = [...this.pendingQuestions];
      this.pendingQuestions = [];
      buffered.forEach((q) => {
        console.log("📤 Delivering buffered question:", q.question_id);
        handler(q);
      });
    } else if (
      handler &&
      this.pendingQuestions.length > 0 &&
      !this.isReadyForQuestions
    ) {
      console.log(
        `⏸️ Handler set but UI not ready - keeping ${this.pendingQuestions.length} questions buffered`
      );
    }
  }

  public get onQuestionReceived() {
    return this._onQuestionReceived;
  }

  public set onGameStarted(handler: ((data: any) => void) | null) {
    console.log("📝 Setting onGameStarted handler", {
      hadHandler: !!this._onGameStarted,
      hasNewHandler: !!handler,
      pendingCount: this.pendingGameStarted.length,
    });

    this._onGameStarted = handler;

    // Deliver any buffered game started events
    if (handler && this.pendingGameStarted.length > 0) {
      console.log(
        `📬 Delivering ${this.pendingGameStarted.length} buffered game started events`
      );
      const buffered = [...this.pendingGameStarted];
      this.pendingGameStarted = [];
      buffered.forEach((data) => {
        console.log("📤 Delivering buffered game started event");
        handler(data);
      });
    }
  }

  public get onGameStarted() {
    return this._onGameStarted;
  }

  // Get the current clock offset from server time
  public getClockOffset(): number {
    return this.clockOffset;
  }

  // Call this when the intro finishes and game is ready to show questions
  public setReadyForQuestions(ready: boolean): void {
    console.log(`📺 UI ready state changed: ${ready}`, {
      wasReady: this.isReadyForQuestions,
      nowReady: ready,
      pendingCount: this.pendingQuestions.length,
      hasHandler: !!this._onQuestionReceived,
    });

    this.isReadyForQuestions = ready;

    // Deliver buffered questions only when ready
    if (ready && this.pendingQuestions.length > 0 && this._onQuestionReceived) {
      console.log(
        `📬 UI ready - delivering ${this.pendingQuestions.length} buffered questions`
      );
      const buffered = [...this.pendingQuestions];
      this.pendingQuestions = [];
      buffered.forEach((q) => {
        console.log("📤 Delivering buffered question:", q.question_id);
        this._onQuestionReceived!(q);
      });
    }

    // Clear buffer when not ready (e.g., leaving game)
    if (!ready && this.pendingQuestions.length > 0) {
      console.log(
        `🗑️ UI not ready - clearing ${this.pendingQuestions.length} buffered questions`
      );
      this.pendingQuestions = [];
    }
  }

  // Get current connection state
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Update connection state and notify listeners
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`🔌 Connection state changed: ${state}`);
      this.onConnectionStateChange?.(state);

      // Also maintain backward compatibility with old status callback
      this.onConnectionStatusChange?.(state === "connected");
    }
  }

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
    // CRITICAL: Prevent duplicate connections
    const now = Date.now();

    // Reset attempt counter if enough time has passed
    if (now - this.lastAttemptTime > this.ATTEMPT_RESET_MS) {
      this.connectionAttemptCount = 0;
      console.log("🔄 Connection attempt counter reset");
    }

    // Check if already connecting
    if (this.isConnecting) {
      console.warn("⚠️ Already connecting, ignoring duplicate connect() call");
      return false;
    }

    // Check if already connected to the same session
    if (this.ws && this.isConnected && this.sessionCode === sessionCode) {
      console.warn(
        "⚠️ Already connected to this session, ignoring duplicate connect() call"
      );
      return true;
    }

    // Check connection attempt limit
    if (this.connectionAttemptCount >= this.MAX_CONNECTION_ATTEMPTS) {
      console.error(
        `❌ Connection attempt limit exceeded (${this.MAX_CONNECTION_ATTEMPTS}). Please wait before trying again.`
      );
      this.onError?.(
        `Too many connection attempts. Please wait ${Math.ceil(
          this.ATTEMPT_RESET_MS / 1000
        )} seconds and try again.`
      );
      return false;
    }

    // Increment attempt counter
    this.connectionAttemptCount++;
    this.lastAttemptTime = now;
    this.isConnecting = true;

    console.log(
      `🔌 Connection attempt ${this.connectionAttemptCount}/${this.MAX_CONNECTION_ATTEMPTS}`
    );

    // If we have an existing connection, disconnect it first
    if (this.ws && this.isConnected) {
      console.warn("⚠️ Already connected, disconnecting old connection first");
      this.disconnect();

      // Wait for old connection to close
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Validate inputs
    if (!sessionCode || sessionCode.trim().length === 0) {
      this.isConnecting = false;
      this.onError?.("Invalid session code. Please scan a valid game QR code.");
      return false;
    }

    if (!playerInfo || !playerInfo.player_name || !playerInfo.player_id) {
      this.isConnecting = false;
      this.onError?.("Invalid player information. Please check your profile.");
      return false;
    }

    this.sessionCode = sessionCode;
    this.playerInfo = playerInfo;
    this.shouldReconnect = true; // Re-enable reconnection for new connection

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
            "Backend reports player already in a session, verifying..."
          );

          // First check if player is in THIS session by trying to get session info
          try {
            const joinInfoResponse = await API.gameSession.getJoinInfo(
              sessionCode
            );

            if (joinInfoResponse.isSuccess) {
              // Session exists and we can get info - player might already be in it
              console.log(
                "Session is accessible, player likely already joined - continuing"
              );
              joinSuccessful = true;
            } else {
              // Can't get session info - try to leave and retry
              console.log(
                "Cannot access session, attempting to leave previous session..."
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
                    "Successfully joined after leaving previous session"
                  );
                  joinSuccessful = true;
                } else {
                  console.log(
                    "Retry join returned error, but continuing to attempt connection"
                  );
                  joinSuccessful = true; // Continue anyway - WebSocket might still work
                }
              } else {
                console.log(
                  "Leave operation unsuccessful, but continuing to attempt connection"
                );
                joinSuccessful = true; // Continue anyway
              }
            }
          } catch (verifyError: any) {
            console.log(
              "Could not verify session state, continuing to attempt connection"
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

      this.setConnectionState("connecting");
      this.ws = new WebSocket(finalWsUrl);

      this.ws.onopen = () => {
        console.log("✅ WebSocket opened - waiting for connection_established");
        // Don't set to connected yet - wait for connection_established message
        this.reconnectAttempts = 0;
        this.connectionAttemptCount = 0; // Reset on successful connection
        this.isConnecting = false; // Connection attempt complete
      };

      this.ws.onmessage = (event) => {
        try {
          const message: GameWebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log("🔌 WebSocket connection closed:", {
          code: event.code,
          reason: event.reason,
        });

        this.isConnecting = false; // Connection attempt complete

        // Handle forced closure due to duplicate connection (code 1000 with specific reason)
        if (
          event.code === 1000 &&
          event.reason === "New connection established"
        ) {
          console.log(
            "🔄 Connection replaced by newer connection from same player"
          );
          this.shouldReconnect = false; // Don't auto-reconnect when replaced
          this.isConnected = false;
          this.setConnectionState("disconnected");
          this.onError?.("Your account connected from another device");
          return;
        }

        // Handle connection limit exceeded (code 1008)
        if (event.code === 1008) {
          console.error("❌ Connection limit exceeded:", event.reason);
          this.shouldReconnect = false; // Don't retry when limit exceeded
          this.isConnected = false;
          this.setConnectionState("disconnected");
          this.onError?.(
            "Connection limit exceeded. Please try again in a moment."
          );
          return;
        }

        console.log(
          "🔌 WebSocket connection closed (continuing with normal handling):",
          {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          }
        );

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
          console.error("WebSocket unsupported data (1003)");
        } else if (event.code === 1011) {
          console.error(
            "WebSocket server error (1011) - Internal server error"
          );
        }

        this.isConnected = false;
        this.stopHeartbeat();

        // Auto-reconnect unless it was a deliberate disconnect
        if (
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts &&
          this.shouldReconnect
        ) {
          console.log(
            `🔄 Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${
              this.maxReconnectAttempts
            }`
          );
          this.setConnectionState("reconnecting");
          this.scheduleReconnect();
        } else {
          this.setConnectionState("disconnected");
        }
      };

      this.ws.onerror = (error) => {
        console.error("❌ WebSocket error occurred:", error);
        this.isConnecting = false; // Connection attempt failed
        this.setConnectionState("disconnected");

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
    console.log("🚫 User initiated disconnect");

    // Prevent auto-reconnection
    this.shouldReconnect = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      try {
        this.ws.close(1000, "User disconnect");
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.wsId = null;
    this.sessionCode = null;
    this.playerInfo = null;
    this.setConnectionState("disconnected");

    // Reset connection tracking
    this.connectionAttemptCount = 0;
    this.lastAttemptTime = 0;

    // Clear all buffered events
    this.pendingQuestions = [];
    this.pendingGameStarted = [];
    this.isReadyForQuestions = false;
    this.waitingForQueueResponse = false;

    console.log("✅ Disconnect complete - all state cleared");
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    // Don't reconnect if flag is set to false (user disconnect or connection replaced)
    if (!this.shouldReconnect) {
      console.log("⚠️ Reconnection disabled, skipping reconnect");
      return;
    }

    // Exponential backoff with max delay of 10 seconds
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    console.log(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.sessionCode && this.playerInfo && this.shouldReconnect) {
        console.log(
          `🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect(this.sessionCode, this.playerInfo);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval

    // Reset pong tracking
    this.lastPongReceived = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (
        this.isConnected &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN
      ) {
        // Check if we've received a pong/ping recently (connection health check)
        const timeSinceLastPong = Date.now() - this.lastPongReceived;

        if (timeSinceLastPong > this.HEARTBEAT_TIMEOUT) {
          console.warn(
            `⚠️ No server activity for ${Math.round(
              timeSinceLastPong / 1000
            )}s - connection appears dead`
          );
          console.log("🔄 Disconnecting and attempting reconnect...");
          this.disconnect();
          this.scheduleReconnect();
          return;
        }

        // Send client-initiated ping to server
        const clientSentAt = Date.now();
        console.log("💓 Sending heartbeat ping with timestamp:", clientSentAt);
        this.sendMessage({
          type: "ping",
          data: { clientSentAt },
          timestamp: new Date().toISOString(),
        });
      }
    }, 30000); // Send ping every 30 seconds (server sends every 15s, we send every 30s)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: GameWebSocketMessage): void {
    console.log("WebSocket message received:", {
      type: message.type,
      hasData: !!message.data,
      timestamp: message.timestamp || Date.now(),
    });

    switch (message.type) {
      case "connection_established":
        console.log(
          "✅ WebSocket connection_established received:",
          message.data
        );
        this.wsId = message.data?.ws_id || null;
        this.isConnected = true;
        this.setConnectionState("connected");
        this.startHeartbeat();

        // CRITICAL: Send connection acknowledgment immediately
        console.log("📤 Sending connection_ack to backend...");
        this.sendMessage({
          type: "connection_ack",
          data: {
            ws_id: this.wsId,
            player_id: this.playerInfo?.player_id,
            session_code: this.sessionCode,
            timestamp: new Date().toISOString(),
          },
        });
        console.log("✅ Connection acknowledgment sent successfully");
        break;

      case "initial_state":
        console.log("Initial state received");
        this.handleInitialState(message.data);
        break;

      case "question_started":
      case "new_question":
      case "question_with_options":
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
          "hasData:",
          !!message.data
        );

        // CRITICAL: question_started means intro is FINISHED
        if (message.type === "question_started") {
          console.log("🎬 question_started received - intro finished");

          // Set ready state immediately when question_started arrives
          if (!this.isReadyForQuestions) {
            console.log("✅ Setting UI ready for questions (intro finished)");
            this.isReadyForQuestions = true;
          }

          // If question_started has no data, request from queue
          if (!message.data) {
            console.log(
              "📬 No data in question_started - requesting from queue"
            );
            this.requestCurrentQuestion();
            break;
          }
          // If it has data, process it below (fall through to normal handling)
          console.log("📦 question_started has data - processing it");
        }

        // Log the full structure to debug what backend is actually sending
        if (message.data) {
          console.log("📋 Question data structure:", {
            keys: Object.keys(message.data),
            has_question: !!message.data.question,
            has_options: !!message.data.options,
            has_display_options: !!message.data.display_options,
            has_question_id: !!message.data.question_id,
            has_ui_mode: !!message.data.ui_mode,
            game_type: message.data.game_type,
          });

          // CRITICAL: Check if handler AND UI are ready, otherwise buffer
          if (this.isReadyForQuestions && this._onQuestionReceived) {
            console.log(
              "✅ UI ready and handler exists - delivering question immediately"
            );
            this._onQuestionReceived(message.data);
            console.log("✅ onQuestionReceived callback invoked");
          } else {
            console.log(
              "📦 Buffering question - UI ready:",
              this.isReadyForQuestions,
              "Handler exists:",
              !!this._onQuestionReceived
            );
            this.pendingQuestions.push(message.data);
          }
        } else {
          console.warn(
            "⚠️ Question event received but no data - triggering fetch"
          );
          // Trigger a manual question fetch if no data in WebSocket event
          const emptyQuestion = {
            question_id: "",
            question: "",
            game_type: "trivia",
            ui_mode: "multiple_choice" as const,
          };

          if (this.isReadyForQuestions && this._onQuestionReceived) {
            this._onQuestionReceived(emptyQuestion);
          } else {
            this.pendingQuestions.push(emptyQuestion);
          }
        }
        break;

      case "broadcast_state":
        console.log("📊 Broadcast state received:", message.type);
        // broadcast_state might contain question data - check and extract
        if (message.data?.current_question || message.data?.question) {
          const questionData =
            message.data.current_question || message.data.question;
          console.log("🎯 Question found in broadcast_state, extracting...");

          if (this.isReadyForQuestions && this._onQuestionReceived) {
            this._onQuestionReceived(questionData);
          } else {
            console.log(
              "📦 Buffering question from broadcast_state - UI ready:",
              this.isReadyForQuestions
            );
            this.pendingQuestions.push(questionData);
          }
        }
        // Also update game state if present
        if (message.data?.game_state) {
          this.onGameStateUpdate?.(message.data.game_state);
        }
        break;

      case "player_joined":
        console.log("Player joined:", message.data);
        this.onPlayerJoined?.(message.data);
        break;

      case "player_left":
        console.log("Player left:", message.data);
        this.onPlayerLeft?.(message.data);
        break;

      case "roster_update":
        console.log("Roster update received:", message.data);
        // Update complete player list
        if (message.data?.players) {
          this.onPlayerJoined?.(message.data); // Reuse callback for roster updates
        }
        break;

      case "game_started":
      case "quiz_started":
      case "start_game":
      case "begin_quiz":
        console.log("🎮 Game started event:", message.type);
        console.log(
          "📦 Game started data:",
          JSON.stringify(message.data, null, 2)
        );

        // DON'T trigger onQuestionReceived here - wait for question_started event
        // game_started = rules introduction begins (mobile should show "Listen to instructions")
        // question_started = rules finished, NOW show question (comes later via WebSocket)
        if (message.data?.currentQuestion) {
          console.log(
            "ℹ️ First question included in game_started (metadata only):",
            {
              question_id: message.data.currentQuestion.question_id,
              question: message.data.currentQuestion.question?.substring(0, 50),
              ui_mode: message.data.currentQuestion.ui_mode,
              has_options: !!message.data.currentQuestion.display_options,
            }
          );
          console.log(
            "⏳ Waiting for question_started event to display question..."
          );
        } else {
          console.log(
            "ℹ️ No question in game_started - will wait for question_started event"
          );
        }

        // Trigger game started with buffering support
        if (this._onGameStarted) {
          console.log("✅ Handler ready - calling onGameStarted immediately");
          this._onGameStarted(message.data);
        } else {
          console.log("⚠️ No handler yet - buffering game started event");
          this.pendingGameStarted.push(message.data);
        }
        break;

      case "game_ended":
        console.log("Game ended:", message.data);
        this.onGameEnded?.(message.data);
        break;

      case "answer_submitted":
      case "player_answered":
        console.log("Answer submitted:", message.data);
        this.onAnswerSubmitted?.(message.data);
        break;

      case "game_status_update":
        console.log("Game status update:", message.data);
        // Treat as game state update
        if (message.data) {
          this.onGameStateUpdate?.(message.data);
        }
        break;

      case "countdown_complete":
        console.log("⏱️ Countdown complete - Game synchronized!");
        console.log("📦 Countdown data:", message.data);

        // Mark game as ready for questions
        if (message.data?.ready_for_question) {
          console.log("✅ Mobile client synchronized - Ready for questions");
          console.log(
            "🎯 Expecting question_started message to arrive next..."
          );
          // The question_started message will arrive right after this
          // This sync pulse ensures mobile is ready to receive and display it
        }
        break;

      case "ui_update":
      case "buzzer_winner":
      case "correct_answer":
      case "incorrect_answer":
        this.onBuzzerUpdate?.(message.data);
        break;

      case "ping":
        // CRITICAL: Server is checking if we're alive - respond immediately
        console.log("📡 Server ping received - sending pong response");
        this.sendMessage({
          type: "pong",
          data: {
            clientTime: Date.now(),
            serverTime: message.data?.serverTime, // Echo back for RTT calculation
          },
          timestamp: new Date().toISOString(),
        });

        // Update last pong received time (we sent pong, connection is active)
        this.lastPongReceived = Date.now();

        // If it's an automatic server ping, don't trigger other handlers
        if (message.data?.auto) {
          console.log(
            "📡 Automatic server ping handled - connection kept alive"
          );
          return;
        }
        break;

      case "pong":
        // Heartbeat response - connection is alive and sync clock
        console.log("💓 Heartbeat pong received - connection alive");

        // Update last pong received time
        this.lastPongReceived = Date.now();

        const clientRecvAt = Date.now();
        const serverTime = message.data?.serverTime;
        const clientSentAt = message.data?.clientSentAt;

        if (serverTime && clientSentAt) {
          // Estimate server clock offset using round-trip time
          const rtt = clientRecvAt - clientSentAt;
          const serverTimeAtMidpoint = serverTime + rtt / 2;
          this.clockOffset = serverTimeAtMidpoint - clientRecvAt;

          console.log(
            `⏰ Clock sync: offset=${this.clockOffset}ms, RTT=${rtt}ms`
          );
        }
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
    if (
      !this.isConnected ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      console.warn("Cannot send message - WebSocket not ready:", {
        isConnected: this.isConnected,
        hasWs: !!this.ws,
        readyState: this.ws?.readyState,
        messageType: message.type,
      });
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send message:", error);
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

  // Request current question from server's queue (called when intro finishes)
  requestCurrentQuestion(): boolean {
    console.log("📬 Requesting current question from server queue");
    this.waitingForQueueResponse = true; // Mark that we're waiting for the queue response
    return this.sendMessage({
      type: "request_current_question",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
        timestamp: new Date().toISOString(),
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

  /**
   * Get connection diagnostics for debugging
   */
  getConnectionDiagnostics(): {
    isConnected: boolean;
    connectionState: ConnectionState;
    sessionCode: string | null;
    playerId: string | null;
    wsId: string | null;
    reconnectAttempts: number;
    isConnecting: boolean;
    connectionAttemptCount: number;
    lastAttemptTime: number;
    shouldReconnect: boolean;
    heartbeatHealth: {
      lastPongReceived: number;
      timeSinceLastPong: number;
      isHealthy: boolean;
    };
  } {
    const timeSinceLastPong = Date.now() - this.lastPongReceived;

    return {
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      sessionCode: this.sessionCode,
      playerId: this.playerInfo?.player_id || null,
      wsId: this.wsId,
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting,
      connectionAttemptCount: this.connectionAttemptCount,
      lastAttemptTime: this.lastAttemptTime,
      shouldReconnect: this.shouldReconnect,
      heartbeatHealth: {
        lastPongReceived: this.lastPongReceived,
        timeSinceLastPong,
        isHealthy: timeSinceLastPong < this.HEARTBEAT_TIMEOUT,
      },
    };
  }

  /**
   * Log connection diagnostics to console
   */
  logConnectionDiagnostics(): void {
    const diagnostics = this.getConnectionDiagnostics();
    const heartbeat = diagnostics.heartbeatHealth;

    console.log("🔍 WebSocket Connection Diagnostics:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  Connected: ${diagnostics.isConnected ? "✅" : "❌"}`);
    console.log(`  State: ${diagnostics.connectionState}`);
    console.log(`  Session Code: ${diagnostics.sessionCode || "None"}`);
    console.log(`  Player ID: ${diagnostics.playerId || "None"}`);
    console.log(`  WS ID: ${diagnostics.wsId || "None"}`);
    console.log(`  Is Connecting: ${diagnostics.isConnecting ? "Yes" : "No"}`);
    console.log(
      `  Reconnect Attempts: ${diagnostics.reconnectAttempts}/${this.maxReconnectAttempts}`
    );
    console.log(
      `  Connection Attempts: ${diagnostics.connectionAttemptCount}/${this.MAX_CONNECTION_ATTEMPTS}`
    );
    console.log(
      `  Should Reconnect: ${diagnostics.shouldReconnect ? "Yes" : "No"}`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💓 Heartbeat Health:");
    console.log(
      `  Time Since Last Activity: ${Math.round(
        heartbeat.timeSinceLastPong / 1000
      )}s`
    );
    console.log(
      `  Health Status: ${heartbeat.isHealthy ? "✅ Healthy" : "⚠️ Unhealthy"}`
    );
    console.log(`  Timeout Threshold: ${this.HEARTBEAT_TIMEOUT / 1000}s`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
}

// Global instance
export const gameWebSocket = new GameWebSocketService();
