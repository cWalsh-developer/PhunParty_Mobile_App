import Constants from "expo-constants";
import * as APIGame from "./API";

export interface GameWebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number | string;
  event_id?: string;
  message_id?: string;
  requires_ack?: boolean;
  serverTime?: number;
}

export interface PlayerInfo {
  player_id: string;
  player_name: string;
  player_photo?: string;
}

export type GamePhase =
  | "lobby"
  | "waiting"
  | "waiting_for_host_intro"
  | "intro_audio"
  | "countdown_pending"
  | "countdown"
  | "question"
  | "ended";

export interface GameState {
  session_code: string;
  game_type: "trivia" | "buzzer" | "category" | string;
  is_active: boolean;
  current_question?: any;
  phase?: GamePhase;
  [key: string]: any;
}

export interface GameQuestion {
  question_id: string;
  question: string;
  options?: string[];
  display_options?: string[];
  correct_index?: number;
  answer?: string;
  game_type: string;
  ui_mode: "multiple_choice" | "buzzer" | "text_input";
  start_at?: string;
}

export interface CountdownState {
  startAt?: string;
  durationMs?: number;
  questionStartAt?: string;
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export class GameWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private connectionState: ConnectionState = "disconnected";
  private clockOffset = 0;
  private wsId: string | null = null;
  private processedEvents = new Set<string>();
  private currentPhase: GamePhase = "lobby";
  private isConnecting = false;
  private shouldReconnect = true;
  private lastActivityAt = Date.now();
  private readonly HEARTBEAT_TIMEOUT = 60000;

  private pendingQuestions: GameQuestion[] = [];
  private pendingGameStarted: any[] = [];
  private isReadyForQuestions = false;
  private questionReceived = false;
  private questionRecoveryTimeouts: any[] = [];

  private _onQuestionReceived: ((question: GameQuestion) => void) | null = null;
  private _onGameStarted: ((data: any) => void) | null = null;

  public isConnected = false;
  public sessionCode: string | null = null;
  public playerInfo: PlayerInfo | null = null;

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
  public onPhaseChange: ((phase: GamePhase, data?: any) => void) | null = null;
  public onCountdownStarted: ((state: CountdownState, data?: any) => void) | null =
    null;

  public set onQuestionReceived(
    handler: ((question: GameQuestion) => void) | null,
  ) {
    this._onQuestionReceived = handler;
    this.flushPendingQuestions();
  }

  public get onQuestionReceived() {
    return this._onQuestionReceived;
  }

  public set onGameStarted(handler: ((data: any) => void) | null) {
    this._onGameStarted = handler;

    if (handler && this.pendingGameStarted.length > 0) {
      const buffered = [...this.pendingGameStarted];
      this.pendingGameStarted = [];
      buffered.forEach((data) => handler(data));
    }
  }

  public get onGameStarted() {
    return this._onGameStarted;
  }

  public getClockOffset(): number {
    return this.clockOffset;
  }

  public estimatedServerNowMs(): number {
    return Date.now() + this.clockOffset;
  }

  public getDelayUntilServerTime(startAtIso: string): number {
    return Math.max(0, Date.parse(startAtIso) - this.estimatedServerNowMs());
  }

  public setReadyForQuestions(ready: boolean): void {
    this.isReadyForQuestions = ready;

    if (!ready) {
      this.pendingQuestions = [];
      this.clearQuestionRecoveryTimeouts();
      return;
    }

    this.flushPendingQuestions();
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  async connect(sessionCode: string, playerInfo: PlayerInfo): Promise<boolean> {
    if (this.isConnecting) {
      return false;
    }

    if (this.ws && this.isConnected && this.sessionCode === sessionCode) {
      return true;
    }

    if (!sessionCode || !playerInfo?.player_id || !playerInfo.player_name) {
      this.onError?.("Invalid session code or player information.");
      return false;
    }

    this.sessionCode = sessionCode;
    this.playerInfo = playerInfo;
    this.shouldReconnect = true;
    this.isConnecting = true;
    this.setConnectionState(
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
    );

    try {
      const API = (await APIGame).default;
      const joinResponse = await API.gameSession.join(
        sessionCode,
        playerInfo.player_id,
      );

      if (!joinResponse.isSuccess && !this.canContinueAfterJoinError(joinResponse.message)) {
        this.isConnecting = false;
        this.onError?.(joinResponse.message || "Unable to join game.");
        return false;
      }

      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);

      if (!joinInfoResponse.isSuccess || !joinInfoResponse.result) {
        this.isConnecting = false;
        this.onError?.(
          joinInfoResponse.message || "Could not get session information.",
        );
        return false;
      }

      const wsUrl = this.buildWebSocketUrl(
        joinInfoResponse.result.websocket_url,
        sessionCode,
        playerInfo,
      );

      this.openWebSocket(wsUrl);
      return true;
    } catch (error: any) {
      this.isConnecting = false;
      this.setConnectionState("disconnected");
      this.onError?.(error.message || "Failed to connect to game session.");
      return false;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimeout();
    this.clearQuestionRecoveryTimeouts();
    this.stopHeartbeat();

    if (this.ws) {
      try {
        this.ws.close(1000, "User disconnect");
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      }
    }

    this.resetConnectionState();
    this.sessionCode = null;
    this.playerInfo = null;
  }

  leaveGame(): void {
    this.sendMessage({
      type: "leave_game",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
    this.disconnect();
  }

  sendMessage(message: GameWebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  }

  submitAnswer(answer: string | number, questionId: string): boolean {
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
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
  }

  requestSessionStats(): boolean {
    return this.requestSync();
  }

  requestCurrentQuestion(): boolean {
    return this.sendMessage({
      type: "request_current_question",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
  }

  async submitAnswerViaAPI(questionId: string, answer: string): Promise<any> {
    try {
      if (!this.sessionCode || !this.playerInfo?.player_id) {
        return { isSuccess: false, message: "Not connected to a session" };
      }

      const API = (await APIGame).default;
      return await API.gameSession.submitAnswer(
        this.sessionCode,
        this.playerInfo.player_id,
        questionId,
        answer,
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
        return { isSuccess: false, message: "Not connected to a session" };
      }

      const API = (await APIGame).default;
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
        return { isSuccess: false, message: "Not connected to a session" };
      }

      const API = (await APIGame).default;
      return await API.gameSession.getCurrentQuestion(this.sessionCode);
    } catch (error: any) {
      return {
        isSuccess: false,
        message: error.message || "Failed to get current question",
      };
    }
  }

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
    const timeSinceLastActivity = Date.now() - this.lastActivityAt;

    return {
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      sessionCode: this.sessionCode,
      playerId: this.playerInfo?.player_id || null,
      wsId: this.wsId,
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting,
      connectionAttemptCount: this.reconnectAttempts,
      lastAttemptTime: this.lastActivityAt,
      shouldReconnect: this.shouldReconnect,
      heartbeatHealth: {
        lastPongReceived: this.lastActivityAt,
        timeSinceLastPong: timeSinceLastActivity,
        isHealthy: timeSinceLastActivity < this.HEARTBEAT_TIMEOUT,
      },
    };
  }

  logConnectionDiagnostics(): void {
    console.log("WebSocket diagnostics:", this.getConnectionDiagnostics());
  }

  private openWebSocket(wsUrl: string): void {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close(1000, "New connection established");
      } catch {
        // Ignore stale socket close failures.
      }
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        this.handleMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.isConnected = false;
      this.wsId = null;
      this.stopHeartbeat();

      if (event.code === 1000 && !this.shouldReconnect) {
        this.setConnectionState("disconnected");
        return;
      }

      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.setConnectionState("reconnecting");
        this.scheduleReconnect();
        return;
      }

      this.setConnectionState("disconnected");
    };

    this.ws.onerror = () => {
      this.isConnecting = false;
    };
  }

  private handleMessage(message: GameWebSocketMessage): void {
    this.lastActivityAt = Date.now();
    this.updateServerOffset(
      message.data?.server_time_ms ??
        message.data?.serverTime ??
        message.serverTime,
    );

    if (message.type === "ping") {
      this.sendMessage({
        type: "pong",
        data: {
          clientTime: Date.now(),
        },
      });
      return;
    }

    if (message.requires_ack) {
      this.sendAck(message);
    }

    if (!this.shouldProcess(message)) {
      return;
    }

    switch (message.type) {
      case "connection_established":
        this.wsId = message.data?.ws_id || null;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.setConnectionState("connected");
        this.startHeartbeat();
        this.sendMessage({
          type: "connection_ack",
          data: {
            ws_id: this.wsId,
            player_id: this.playerInfo?.player_id,
            session_code: this.sessionCode,
          },
        });
        this.requestSync();
        break;

      case "initial_state":
        this.applyAuthoritativeState(
          message.data?.authoritative_state ?? message.data,
        );
        if (message.data?.connected_players) {
          this.onPlayerJoined?.({ players: message.data.connected_players });
        }
        break;

      case "sync_state":
        this.applyAuthoritativeState(
          message.data?.authoritative_state ?? message.data,
        );
        break;

      case "roster_update":
      case "player_joined":
        this.onPlayerJoined?.(message.data);
        break;

      case "player_left":
        this.onPlayerLeft?.(message.data);
        break;

      case "game_started":
        this.questionReceived = false;
        this.setReadyForQuestions(true);
        this.setPhase("waiting_for_host_intro", message.data);
        this.emitGameStarted(message.data);
        break;

      case "intro_started":
        this.setReadyForQuestions(true);
        this.setPhase("waiting_for_host_intro", message.data);
        break;

      case "intro_skipped":
        this.setPhase("countdown_pending", message.data);
        break;

      case "countdown_started":
        this.questionReceived = false;
        this.clearQuestionRecoveryTimeouts();
        this.setReadyForQuestions(true);
        this.setPhase("countdown", message.data);
        this.emitCountdownStarted(message.data);
        break;

      case "preload_question":
        break;

      case "question_started":
        this.setReadyForQuestions(true);
        this.setPhase("question", message.data);
        if (message.data) {
          this.deliverOrBufferQuestion(message.data, "question_started");
        } else {
          this.scheduleQuestionRecovery("empty_question_started");
        }
        break;

      case "current_question":
      case "question":
        if (this.currentPhase === "question" && message.data) {
          this.deliverOrBufferQuestion(message.data, message.type);
        }
        break;

      case "game_status_update":
        if (message.data) {
          this.onGameStateUpdate?.(message.data);
        }
        break;

      case "game_ended":
        this.setPhase("ended", message.data);
        this.onGameEnded?.(message.data);
        break;

      case "answer_submitted":
      case "player_answered":
        this.onAnswerSubmitted?.(message.data);
        break;

      case "ui_update":
      case "buzzer_winner":
      case "correct_answer":
      case "incorrect_answer":
        this.onBuzzerUpdate?.(message.data);
        break;

      case "pong":
        this.updateServerOffset(message.data?.serverTime ?? message.serverTime);
        break;

      case "error":
        this.onError?.(message.data?.message || "An error occurred");
        break;

      default:
        break;
    }
  }

  private applyAuthoritativeState(state: any): void {
    if (!state) {
      return;
    }

    this.updateServerOffset(state.server_time_ms ?? state.serverTime);

    const gameState = state.game_state ?? state;
    this.onGameStateUpdate?.(gameState);

    const phase = this.normalizePhase(gameState);
    this.setPhase(phase, gameState);

    if (phase !== "lobby" && phase !== "waiting") {
      this.setReadyForQuestions(true);
    }

    if (phase === "countdown") {
      this.emitCountdownStarted(gameState);
      return;
    }

    if (phase === "question") {
      const question = gameState.current_question ?? gameState.question;

      if (question) {
        this.deliverOrBufferQuestion(question, "authoritative_state");
      } else {
        this.scheduleQuestionRecovery("sync_state_question");
      }
    }
  }

  private normalizePhase(state: any): GamePhase {
    const phase = state?.phase;

    if (phase === "lobby") return "lobby";
    if (phase === "intro_audio") return "waiting_for_host_intro";
    if (phase === "countdown") return "countdown";
    if (phase === "question") return "question";
    if (phase === "ended") return "ended";

    if (state?.ended_at || state?.is_ended) return "ended";
    if (state?.is_active || state?.isstarted) return "waiting_for_host_intro";

    return "lobby";
  }

  private emitGameStarted(data: any): void {
    if (this._onGameStarted) {
      this._onGameStarted(data);
    } else {
      this.pendingGameStarted.push(data);
    }
  }

  private emitCountdownStarted(data: any): void {
    this.onCountdownStarted?.(
      {
        startAt: data?.start_at,
        durationMs: data?.duration_ms,
        questionStartAt: data?.question_start_at,
      },
      data,
    );
  }

  private deliverOrBufferQuestion(questionData: any, source: string): void {
    if (!questionData) {
      return;
    }

    this.questionReceived = true;
    this.clearQuestionRecoveryTimeouts();

    const question: GameQuestion = {
      game_type: questionData.game_type || questionData.genre || "trivia",
      ui_mode: questionData.ui_mode || "multiple_choice",
      ...questionData,
    };

    if (this.isReadyForQuestions && this._onQuestionReceived) {
      this._onQuestionReceived(question);
      return;
    }

    console.log(`Buffering question from ${source}`);
    this.pendingQuestions.push(question);
  }

  private flushPendingQuestions(): void {
    if (
      !this.isReadyForQuestions ||
      !this._onQuestionReceived ||
      this.pendingQuestions.length === 0
    ) {
      return;
    }

    const buffered = [...this.pendingQuestions];
    this.pendingQuestions = [];
    buffered.forEach((question) => this._onQuestionReceived?.(question));
  }

  private scheduleQuestionRecovery(
    reason: string,
    delaysMs: number[] = [500, 1500, 3500],
  ): void {
    this.clearQuestionRecoveryTimeouts();

    delaysMs.forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!this.isConnected || this.questionReceived) {
          return;
        }

        console.log(`Requesting current question after ${reason}`);
        this.requestCurrentQuestion();
      }, delay);

      this.questionRecoveryTimeouts.push(timeout);
    });
  }

  private clearQuestionRecoveryTimeouts(): void {
    this.questionRecoveryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.questionRecoveryTimeouts = [];
  }

  private sendAck(message: GameWebSocketMessage): void {
    const eventId = this.getEventId(message);

    if (!eventId) {
      return;
    }

    this.sendMessage({
      type: "ack",
      event_id: eventId,
      data: {
        event_id: eventId,
      },
    });
  }

  private shouldProcess(message: GameWebSocketMessage): boolean {
    const eventId = this.getEventId(message);

    if (!eventId) {
      return true;
    }

    if (this.processedEvents.has(eventId)) {
      return false;
    }

    this.processedEvents.add(eventId);

    if (this.processedEvents.size > 500) {
      Array.from(this.processedEvents)
        .slice(0, 100)
        .forEach((id) => this.processedEvents.delete(id));
    }

    return true;
  }

  private getEventId(message: GameWebSocketMessage): string | undefined {
    return message.event_id || message.message_id;
  }

  private updateServerOffset(serverTimeMs?: number): void {
    if (typeof serverTimeMs !== "number" || Number.isNaN(serverTimeMs)) {
      return;
    }

    this.clockOffset = serverTimeMs - Date.now();
  }

  private requestSync(): boolean {
    return this.sendMessage({
      type: "sync_request",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
      },
    });
  }

  private setPhase(phase: GamePhase, data?: any): void {
    this.currentPhase = phase;
    this.onPhaseChange?.(phase, data);
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return;
    }

    this.connectionState = state;
    this.onConnectionStateChange?.(state);
    this.onConnectionStatusChange?.(state === "connected");
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastActivityAt = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - this.lastActivityAt > this.HEARTBEAT_TIMEOUT) {
        this.closeForReconnect();
        return;
      }

      this.sendMessage({
        type: "ping",
        data: {
          clientSentAt: Date.now(),
        },
      });
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private closeForReconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();

    if (this.ws) {
      try {
        this.ws.close(4000, "Connection stale");
      } catch {
        this.scheduleReconnect();
      }
    } else {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || !this.shouldReconnect) {
      return;
    }

    const delays = [500, 1000, 2000, 3000, 5000];
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)];
    this.reconnectAttempts += 1;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;

      if (this.sessionCode && this.playerInfo && this.shouldReconnect) {
        this.connect(this.sessionCode, this.playerInfo);
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private resetConnectionState(): void {
    this.ws = null;
    this.wsId = null;
    this.isConnected = false;
    this.pendingQuestions = [];
    this.pendingGameStarted = [];
    this.isReadyForQuestions = false;
    this.questionReceived = false;
    this.processedEvents.clear();
    this.currentPhase = "lobby";
    this.setConnectionState("disconnected");
  }

  private canContinueAfterJoinError(message?: string): boolean {
    const error = message?.toLowerCase() || "";
    return (
      error.includes("already in a game session") ||
      error.includes("already in session") ||
      error === "unable to join game"
    );
  }

  private buildWebSocketUrl(
    backendUrl: string | undefined,
    sessionCode: string,
    playerInfo: PlayerInfo,
  ): string {
    const baseUrl = backendUrl || `${this.getWebSocketBaseUrl()}/ws/session/${sessionCode}`;
    const params = new URLSearchParams();
    const apiKey = Constants.expoConfig?.extra?.API_KEY;

    if (apiKey) {
      params.append("api_key", apiKey);
    }

    params.append("client_type", "mobile");
    params.append("player_id", playerInfo.player_id);
    params.append("player_name", playerInfo.player_name);

    if (playerInfo.player_photo) {
      params.append("player_photo", playerInfo.player_photo);
    }

    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${params.toString()}`;
  }

  private getWebSocketBaseUrl(): string {
    const baseUrl =
      Constants.expoConfig?.extra?.API_BASE_URL ||
      Constants.expoConfig?.extra?.API_URL ||
      "https://api.phun.party";

    if (baseUrl.startsWith("https://")) {
      return baseUrl.replace(/^https:\/\//, "wss://");
    }

    if (baseUrl.startsWith("http://")) {
      return baseUrl.replace(/^http:\/\//, "ws://");
    }

    return `wss://${baseUrl.replace(/^\/+/, "")}`;
  }
}

export const gameWebSocket = new GameWebSocketService();
