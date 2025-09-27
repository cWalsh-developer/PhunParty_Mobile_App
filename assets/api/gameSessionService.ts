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
      // Step 1: Join session via HTTP API (creates session assignment)
      console.log(
        `Joining session ${sessionCode} for player ${playerInfo.player_name}`
      );

      const joinResponse = await API.gameSession.join(
        sessionCode,
        playerInfo.player_id
      );
      if (!joinResponse.isSuccess) {
        // Check if player is already in session - this might be ok
        if (joinResponse.message?.includes("already in a game session")) {
          console.log("Player already in session, continuing...");
        } else {
          return { success: false, message: joinResponse.message };
        }
      }

      // Step 2: Get session join info
      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);
      if (!joinInfoResponse.isSuccess) {
        return { success: false, message: joinInfoResponse.message };
      }

      const sessionInfo = joinInfoResponse.result;
      this.sessionCode = sessionCode;

      // Step 3: Connect to WebSocket for real-time updates
      const wsConnected = await gameWebSocket.connect(sessionCode, playerInfo);

      if (!wsConnected) {
        console.warn("WebSocket connection failed, will use HTTP polling");
      }

      return {
        success: true,
        sessionInfo,
        message: `Successfully joined ${sessionInfo.host_name}'s game`,
      };
    } catch (error: any) {
      console.error("Error joining session:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current session status - matches backend GameSessionState model
   */
  async getSessionStatus(): Promise<GameSessionState | null> {
    if (!this.sessionCode) {
      throw new Error("Not connected to a session");
    }

    try {
      const response = await API.gameSession.getStatus(this.sessionCode);
      if (response.isSuccess) {
        return response.result;
      }
      throw new Error(response.message);
    } catch (error) {
      console.error("Error getting session status:", error);
      return null;
    }
  }

  /**
   * Get current question - matches backend Questions model
   */
  async getCurrentQuestion(): Promise<GameQuestion | null> {
    if (!this.sessionCode) {
      throw new Error("Not connected to a session");
    }

    try {
      const response = await API.gameSession.getCurrentQuestion(
        this.sessionCode
      );
      if (response.isSuccess) {
        return response.result;
      }
      throw new Error(response.message);
    } catch (error) {
      console.error("Error getting current question:", error);
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
      throw new Error("Not connected to a session");
    }

    try {
      // Try WebSocket first for real-time submission
      if (this.isWebSocketConnected) {
        const sent = gameWebSocket.submitAnswer(answer, questionId);
        if (sent) {
          // WebSocket submission sent - response will come via WebSocket events
          return {
            message: "Answer submitted via WebSocket",
            is_correct: false, // Will be updated via WebSocket event
            current_score: 0, // Will be updated via WebSocket event
            game_status: "question_answered",
          };
        }
      }

      // Fallback to HTTP API
      const response = await gameWebSocket.submitAnswerViaAPI(
        questionId,
        answer
      );
      if (response.isSuccess) {
        return response.result;
      }
      throw new Error(response.message);
    } catch (error: any) {
      console.error("Error submitting answer:", error);
      throw error;
    }
  }

  /**
   * Press buzzer for buzzer-style games
   */
  async pressBuzzer(): Promise<boolean> {
    if (!this.sessionCode) {
      throw new Error("Not connected to a session");
    }

    // Try WebSocket first
    if (this.isWebSocketConnected) {
      return gameWebSocket.pressBuzzer();
    }

    // No HTTP fallback for buzzer - requires real-time WebSocket
    throw new Error("Buzzer requires WebSocket connection");
  }

  /**
   * Leave the session - cleans up connections
   */
  async leaveSession(): Promise<void> {
    this.stopPolling();

    if (this.isWebSocketConnected) {
      gameWebSocket.disconnect();
    }

    this.sessionCode = null;
    this.isWebSocketConnected = false;
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
