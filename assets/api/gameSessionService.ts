import API from "./API";
import {
  GameQuestion,
  GameSessionState,
  SubmitAnswerResponse,
} from "./gameTypes";
import {
  gameWebSocket,
  GameQuestion as WSGameQuestion,
} from "./gameWebSocketService";

/**
 * Comprehensive game session service that integrates WebSocket real-time communication
 * with HTTP API fallbacks, matching the PhunParty backend implementation.
 */
export class GameSessionService {
  private sessionCode: string | null = null;
  private isWebSocketConnected = false;
  private pollingInterval: any = null;

  constructor() {
    // Monitor WebSocket connection status
    gameWebSocket.onConnectionStatusChange = (connected) => {
      this.isWebSocketConnected = connected;
    };
  }

  /**
   * Join a game session - integrates with backend session assignment logic
   */
  async joinSession(
    sessionCode: string,
    playerInfo: {
      player_id: string;
      player_name: string;
      player_photo?: string;
    }
  ): Promise<{ success: boolean; message?: string; sessionInfo?: any }> {
    try {
      // Validate inputs
      if (!sessionCode || !playerInfo?.player_id || !playerInfo?.player_name) {
        console.error("Invalid session code or player info");
        return {
          success: false,
          message: "Invalid session code or player information",
        };
      }

      // Step 1: Join session via HTTP API (creates session assignment)
      console.log(
        `🎮 [GameSessionService] Joining session ${sessionCode} for player ${playerInfo.player_name} (${playerInfo.player_id})`
      );

      const joinResponse = await API.gameSession.join(
        sessionCode,
        playerInfo.player_id
      );

      console.log("🎮 [GameSessionService] Join response:", {
        isSuccess: joinResponse.isSuccess,
        message: joinResponse.message,
      });

      if (!joinResponse.isSuccess) {
        // Check if player is already in session - this might be ok
        if (joinResponse.message?.includes("already in a game session")) {
          console.log("✅ Player already in session, continuing...");
        } else {
          console.error("❌ Join failed:", joinResponse.message);
          return {
            success: false,
            message: joinResponse.message || "Failed to join session",
          };
        }
      } else {
        console.log("✅ Successfully joined session via API");
      }

      // Step 2: Get session join info
      console.log("🔍 Getting session join info...");
      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);

      console.log("🔍 Join info response:", {
        isSuccess: joinInfoResponse.isSuccess,
        hasResult: !!joinInfoResponse.result,
      });

      if (!joinInfoResponse.isSuccess) {
        console.error("❌ Failed to get join info:", joinInfoResponse.message);
        return {
          success: false,
          message:
            joinInfoResponse.message || "Failed to get session information",
        };
      }

      if (!joinInfoResponse.result) {
        console.error("❌ Join info result is empty");
        return {
          success: false,
          message: "Session information is empty. The session may be invalid.",
        };
      }

      const sessionInfo = joinInfoResponse.result;
      this.sessionCode = sessionCode;

      console.log("✅ Session info received:", {
        session_code: sessionInfo.session_code,
        host_name: sessionInfo.host_name,
        game_code: sessionInfo.game_code,
      });

      // Step 3: Connect to WebSocket for real-time updates
      console.log("🔌 Connecting to WebSocket...");
      const wsConnected = await gameWebSocket.connect(sessionCode, playerInfo);

      if (!wsConnected) {
        console.warn("⚠️ WebSocket connection failed, will use HTTP polling");
      } else {
        console.log("✅ WebSocket connected successfully");
      }

      return {
        success: true,
        sessionInfo,
        message: `Successfully joined ${sessionInfo.host_name}'s game`,
      };
    } catch (error: any) {
      console.error("❌ Error joining session:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        sessionCode,
        playerId: playerInfo?.player_id,
      });
      return {
        success: false,
        message:
          error.message ||
          "An unexpected error occurred while joining the session",
      };
    }
  }

  /**
   * Get current session status - matches backend GameSessionState model
   */
  async getSessionStatus(): Promise<GameSessionState | null> {
    if (!this.sessionCode) {
      console.error("getSessionStatus: Not connected to a session");
      return null;
    }

    try {
      const response = await API.gameSession.getStatus(this.sessionCode);
      if (response.isSuccess) {
        if (!response.result) {
          console.error("getSessionStatus: No result in response");
          return null;
        }
        return response.result;
      }
      console.error("getSessionStatus failed:", response.message);
      return null;
    } catch (error: any) {
      console.error("Error getting session status:", error);
      console.error("Error details:", {
        message: error.message,
        sessionCode: this.sessionCode,
      });
      return null;
    }
  }

  /**
   * Get current question - matches backend Questions model
   */
  async getCurrentQuestion(): Promise<GameQuestion | null> {
    if (!this.sessionCode) {
      console.error("getCurrentQuestion: Not connected to a session");
      return null;
    }

    try {
      const response = await API.gameSession.getCurrentQuestion(
        this.sessionCode
      );
      if (response.isSuccess) {
        if (!response.result) {
          console.error("getCurrentQuestion: No result in response");
          return null;
        }
        return response.result;
      }
      console.error("getCurrentQuestion failed:", response.message);
      return null;
    } catch (error: any) {
      console.error("Error getting current question:", error);
      console.error("Error details:", {
        message: error.message,
        sessionCode: this.sessionCode,
      });
      return null;
    }
  }

  /**
   * Submit answer - uses WebSocket if available, falls back to HTTP API
   * Integrates with backend submit_player_answer logic
   */
  async submitAnswer(
    questionId: string,
    answer: string
  ): Promise<SubmitAnswerResponse | null> {
    if (!this.sessionCode) {
      console.error("submitAnswer: Not connected to a session");
      return null;
    }

    if (!questionId || !answer) {
      console.error("submitAnswer: Invalid questionId or answer");
      return null;
    }

    try {
      // Try WebSocket first for real-time submission
      if (this.isWebSocketConnected) {
        try {
          const sent = gameWebSocket.submitAnswer(answer, questionId);
          if (sent) {
            // WebSocket submission sent - response will come via WebSocket events
            return {
              message: "Answer submitted via WebSocket",
              is_correct: false, // Will be updated via WebSocket event
              current_score: 0, // Will be updated via WebSocket event
              game_state: "question_answered",
            };
          }
        } catch (wsError: any) {
          console.error(
            "WebSocket submit failed, falling back to HTTP:",
            wsError
          );
        }
      }

      // Fallback to HTTP API
      const response = await gameWebSocket.submitAnswerViaAPI(
        questionId,
        answer
      );

      if (response.isSuccess) {
        if (!response.result) {
          console.error("submitAnswer: No result in response");
          return null;
        }
        return response.result;
      }

      console.error("submitAnswer failed:", response.message);
      return null;
    } catch (error: any) {
      console.error("Error submitting answer:", error);
      console.error("Error details:", {
        message: error.message,
        sessionCode: this.sessionCode,
        questionId,
      });
      return null;
    }
  }

  /**
   * Press buzzer for buzzer-style games
   */
  async pressBuzzer(): Promise<boolean> {
    if (!this.sessionCode) {
      console.error("pressBuzzer: Not connected to a session");
      return false;
    }

    // Try WebSocket first
    if (this.isWebSocketConnected) {
      try {
        return gameWebSocket.pressBuzzer();
      } catch (error: any) {
        console.error("Error pressing buzzer:", error);
        return false;
      }
    }

    // No HTTP fallback for buzzer - requires real-time WebSocket
    console.error("pressBuzzer: Buzzer requires WebSocket connection");
    return false;
  }

  /**
   * Leave the session - cleans up connections
   */
  async leaveSession(): Promise<void> {
    try {
      this.stopPolling();

      if (this.isWebSocketConnected) {
        try {
          gameWebSocket.disconnect();
        } catch (wsError: any) {
          console.error("Error disconnecting WebSocket:", wsError);
        }
      }

      this.sessionCode = null;
      this.isWebSocketConnected = false;
    } catch (error: any) {
      console.error("Error leaving session:", error);
      // Still reset state even if there's an error
      this.sessionCode = null;
      this.isWebSocketConnected = false;
    }
  }

  /**
   * Set up event listeners for real-time game events
   */
  setupEventListeners(callbacks: {
    onGameStateUpdate?: (gameState: any) => void;
    onQuestionReceived?: (question: WSGameQuestion) => void;
    onPlayerJoined?: (playerInfo: any) => void;
    onPlayerLeft?: (playerInfo: any) => void;
    onGameStarted?: (data: any) => void;
    onGameEnded?: (data: any) => void;
    onAnswerSubmitted?: (data: any) => void;
    onBuzzerUpdate?: (data: any) => void;
    onError?: (error: string) => void;
  }) {
    gameWebSocket.onGameStateUpdate = callbacks.onGameStateUpdate || null;
    gameWebSocket.onQuestionReceived = callbacks.onQuestionReceived || null;
    gameWebSocket.onPlayerJoined = callbacks.onPlayerJoined || null;
    gameWebSocket.onPlayerLeft = callbacks.onPlayerLeft || null;
    gameWebSocket.onGameStarted = callbacks.onGameStarted || null;
    gameWebSocket.onGameEnded = callbacks.onGameEnded || null;
    gameWebSocket.onAnswerSubmitted = callbacks.onAnswerSubmitted || null;
    gameWebSocket.onBuzzerUpdate = callbacks.onBuzzerUpdate || null;
    gameWebSocket.onError = callbacks.onError || null;
  }

  /**
   * Poll for session updates when WebSocket is not available
   */
  startPolling(intervalMs: number = 2000): any {
    if (this.isWebSocketConnected || !this.sessionCode) {
      return null;
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const status = await this.getSessionStatus();
        if (status) {
          // Convert GameSessionState to GameState format for WebSocket callback
          const gameState = {
            session_code: status.session_code,
            game_type: "trivia", // Default game type
            is_active: status.is_active,
            isstarted: status.isstarted,
            current_question: status.current_question,
          };
          gameWebSocket.onGameStateUpdate?.(gameState);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, intervalMs);

    return this.pollingInterval;
  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Getters
  get currentSessionCode(): string | null {
    return this.sessionCode;
  }

  get isConnected(): boolean {
    return this.isWebSocketConnected;
  }
}

// Global instance
export const gameSessionService = new GameSessionService();
