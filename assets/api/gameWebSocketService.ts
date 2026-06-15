import Constants from "expo-constants";
import { getToken } from "../authentication-storage/authStorage";
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
  accepted_answers?: string[];
  correct_index?: number;
  answer?: string;
  correct_answer?: string;
  difficulty?: string;
  game_type: string;
  ui_mode: "multiple_choice" | "buzzer" | "text_input";
  button_state?: string;
  buttonState?: string;
  is_current_player?: boolean;
  isCurrentPlayer?: boolean;
  message?: string;
  grace_period_ms?: number;
  gracePeriodMs?: number;
  start_at?: string;
  ends_at?: string;
  duration_seconds?: number;
  score?: number;
  answered_count?: number;
  correct_count?: number;
}

export interface CountdownState {
  startAt?: string;
  durationMs?: number;
  questionStartAt?: string;
}

export type FocusViolationReason =
  | "app_backgrounded"
  | "app_inactive"
  | "screen_blurred"
  | "multi_window_mode"
  | "picture_in_picture_mode"
  | "window_focus_lost";

export type FairPlayFocusEvent = "lost" | "returned";

export interface FairPlaySettings {
  enabled: boolean;
  maxStrikes: number;
}

export interface FairPlayStatus {
  player_id?: string;
  roster_player_id?: string;
  rosterPlayerId?: string;
  public_player_id?: string;
  player_key?: string;
  playerId?: string;
  participant_id?: string;
  strike_count?: number;
  strikeCount?: number;
  fair_play_strikes?: number;
  fairPlayStrikes?: number;
  fair_play_strike_count?: number;
  fairPlayStrikeCount?: number;
  current_strikes?: number;
  currentStrikes?: number;
  strikes?: number;
  max_strikes?: number;
  maxStrikes?: number;
  max_fair_play_strikes?: number;
  maxFairPlayStrikes?: number;
  max_cheat_strikes?: number;
  maxCheatStrikes?: number;
  strike_limit?: number;
  strikeLimit?: number;
  is_frozen?: boolean;
  isFrozen?: boolean;
  frozen_for_question?: boolean;
  frozen_question_id?: string;
  frozenQuestionId?: string;
  question_id?: string;
  is_kicked?: boolean;
  isKicked?: boolean;
  answered_current?: boolean;
  answer_status?: string;
  reason?: string;
  message?: string;
  grace_period_ms?: number;
  gracePeriodMs?: number;
  event_type?: string;
}

export interface BuzzerStateUpdate {
  question_id?: string;
  current_buzzer_winner?: string | null;
  current_buzzer_winner_roster_id?: string | null;
  currentBuzzerWinner?: string | null;
  frozen_players?: string[];
  frozen_roster_player_ids?: string[];
  frozenPlayers?: string[];
  question_active?: boolean;
  questionActive?: boolean;
  server_time_ms?: number;
  serverTime?: number;
  event_type?: string;
  type?: string;
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
  private rosterPlayerId: string | null = null;
  private processedEvents = new Set<string>();
  private currentPhase: GamePhase = "lobby";
  private isConnecting = false;
  private shouldReconnect = true;
  private cachedWebSocketUrl: string | null = null;
  private lastActivityAt = Date.now();
  private readonly HEARTBEAT_TIMEOUT = 60000;

  private pendingQuestions: GameQuestion[] = [];
  private lastQuestion: GameQuestion | null = null;
  private pendingGameStarted: any[] = [];
  private pendingFairPlayReturns = new Map<string, string>();
  private isReadyForQuestions = false;
  private questionReceived = false;
  private questionRecoveryTimeouts: any[] = [];
  private questionStartTimeout: any = null;
  private knownGameType: string | null = null;

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
  public onAnswerRejected: ((data: any) => void) | null = null;
  public onBuzzerUpdate: ((data: any) => void) | null = null;
  public onBeatClockAnswerResult: ((data: any) => void) | null = null;
  public onBeatClockStateUpdate: ((data: any) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onPhaseChange: ((phase: GamePhase, data?: any) => void) | null = null;
  public onCountdownStarted:
    | ((state: CountdownState, data?: any) => void)
    | null = null;
  public onFairPlaySettingsUpdate:
    | ((settings: FairPlaySettings | any) => void)
    | null = null;
  public onFairPlayStatusUpdate:
    | ((status: FairPlayStatus | any) => void)
    | null = null;
  public onFairPlayStatusRefreshRequested: (() => void) | null = null;
  public onKickedFromSession: ((data: FairPlayStatus | any) => void) | null =
    null;

  public set onQuestionReceived(
    handler: ((question: GameQuestion) => void) | null,
  ) {
    this._onQuestionReceived = handler;

    if (
      handler &&
      this.isReadyForQuestions &&
      this.currentPhase === "question" &&
      this.lastQuestion
    ) {
      handler(this.lastQuestion);
      this.pendingQuestions = [];
      return;
    }

    if (this.currentPhase === "question") {
      this.flushPendingQuestions();
    }
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

  private isBeatClockGameType(data?: any): boolean {
    const rawType =
      data?.game_type ??
      data?.gameType ??
      data?.game_state?.game_type ??
      data?.game_state?.gameType;
    const questionId =
      data?.question_id ??
      data?.questionId ??
      data?.current_question_id ??
      data?.currentQuestionId ??
      data?.question?.question_id ??
      data?.question?.questionId ??
      data?.current_question?.question_id ??
      data?.currentQuestion?.questionId;
    const normalized =
      typeof rawType === "string"
        ? rawType.trim().toLowerCase().replace(/[_\s]+/g, "-")
        : "";
    return (
      normalized === "beat-the-clock" ||
      normalized === "beat-clock" ||
      String(questionId ?? "").toUpperCase().startsWith("BTC")
    );
  }

  private rememberGameType(data?: any): void {
    if (!data) {
      return;
    }

    if (this.isBeatClockGameType(data)) {
      this.knownGameType = "beat_the_clock";
      return;
    }

    if (this.knownGameType === "beat_the_clock") {
      return;
    }

    const rawType =
      data?.game_type ??
      data?.gameType ??
      data?.game_state?.game_type ??
      data?.game_state?.gameType;
    if (typeof rawType === "string" && rawType.trim()) {
      this.knownGameType = rawType.trim().toLowerCase().replace(/[_\s]+/g, "-");
    }
  }

  private shouldIgnoreGenericQuestion(data?: any): boolean {
    return (
      this.knownGameType === "beat_the_clock" &&
      data !== undefined &&
      !this.isBeatClockGameType(data)
    );
  }

  private withStableGameType<T extends any>(data: T): T {
    if (
      this.knownGameType !== "beat_the_clock" ||
      !data ||
      typeof data !== "object"
    ) {
      return data;
    }

    return {
      ...(data as any),
      game_type: "beat_the_clock",
      gameType: "beat_the_clock",
    };
  }

  public setReadyForQuestions(ready: boolean): void {
    this.isReadyForQuestions = ready;

    if (!ready) {
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

    const isSameSession =
      this.sessionCode === sessionCode &&
      this.playerInfo?.player_id === playerInfo.player_id;

    if (!isSameSession) {
      this.cachedWebSocketUrl = null;
      this.reconnectAttempts = 0;
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
      const joinResponse = await API.gameSession.join(sessionCode);

      if (
        !joinResponse.isSuccess &&
        !this.canContinueAfterJoinError(joinResponse.message)
      ) {
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

      const wsUrl = await this.buildWebSocketUrl(
        joinInfoResponse.result.websocket_url,
        sessionCode,
        playerInfo,
      );

      this.cachedWebSocketUrl = wsUrl;
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
    this.cachedWebSocketUrl = null;
    this.sessionCode = null;
    this.playerInfo = null;
  }

  stopReconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimeout();
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
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isConnected
    ) {
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

  pressBuzzer(questionId?: string): boolean {
    console.log("📣 Sending buzzer_press:", {
      sessionCode: this.sessionCode,
      playerId: this.playerInfo?.player_id,
      questionId,
      connected: this.isConnected,
      readyState: this.ws?.readyState,
      connectionState: this.connectionState,
    });

    const sent = this.sendMessage({
      type: "buzzer_press",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
        question_id: questionId,
      },
    });

    console.log("📣 buzzer_press send result:", {
      sent,
      questionId,
    });

    return sent;
  }

  reportFocusViolation(
    questionId: string,
    reason: FocusViolationReason,
  ): boolean {
    return this.sendMessage({
      type: "focus_violation",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
        question_id: questionId,
        reason,
        occurred_at: new Date().toISOString(),
      },
    });
  }

  reportFairPlayFocusLost(
    questionId: string,
    reason: FocusViolationReason,
  ): boolean {
    console.log("[FAIR PLAY] WebSocket sending fair_play_focus_lost", {
      sessionCode: this.sessionCode,
      playerId: this.playerInfo?.player_id,
      questionId,
      reason,
      isConnected: this.isConnected,
      connectionState: this.connectionState,
    });
    return this.sendMessage({
      type: "fair_play_focus_lost",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
        question_id: questionId,
        reason,
        occurred_at: new Date().toISOString(),
      },
    });
  }

  reportFairPlayFocusReturned(questionId: string): boolean {
    const returnedAt = new Date().toISOString();
    const sent = this.sendMessage({
      type: "fair_play_focus_returned",
      data: {
        session_code: this.sessionCode,
        player_id: this.playerInfo?.player_id,
        question_id: questionId,
        returned_at: returnedAt,
      },
    });

    if (!sent) {
      this.pendingFairPlayReturns.set(questionId, returnedAt);
    }

    return sent;
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
    rosterPlayerId: string | null;
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
      rosterPlayerId: this.rosterPlayerId,
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
      this.rosterPlayerId = null;
      this.stopHeartbeat();

      if (event.code === 4003) {
        this.handleKickedFromSession(
          {
            reason: "fair_play_strikes",
            message:
              event.reason ||
              "You were removed after reaching the Fair Play strike limit.",
          },
          "websocket_closed",
          false,
        );
        this.onFairPlayStatusRefreshRequested?.();
        this.setConnectionState("disconnected");
        return;
      }

      if (event.code === 1000 && !this.shouldReconnect) {
        this.setConnectionState("disconnected");
        return;
      }

      if (this.currentPhase !== "lobby" && this.currentPhase !== "ended") {
        this.onFairPlayStatusRefreshRequested?.();
      }

      if (
        this.shouldReconnect &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
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
        this.rosterPlayerId = message.data?.roster_player_id || null;
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
        this.flushPendingFairPlayReturns();
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
        this.rememberGameType(message.data);
        this.questionReceived = false;
        this.lastQuestion = null;
        this.pendingQuestions = [];
        if (
          this.isBeatClockGameType(message.data) &&
          (message.data?.phase === "question" || message.data?.ends_at)
        ) {
          this.clearQuestionRecoveryTimeouts();
          this.setReadyForQuestions(true);
          this.setPhase("question", message.data);
          this.onBeatClockStateUpdate?.(message.data ?? {});
        } else {
          this.setReadyForQuestions(false);
          this.setPhase("waiting_for_host_intro", message.data);
        }
        this.emitGameStarted(message.data);
        break;

      case "intro_started":
        this.rememberGameType(message.data);
        this.setReadyForQuestions(false);
        this.setPhase("waiting_for_host_intro", message.data);
        break;

      case "intro_skipped":
        this.rememberGameType(message.data);
        this.setPhase("countdown_pending", message.data);
        break;

      case "countdown_started":
        this.rememberGameType(message.data);
        this.questionReceived = false;
        this.clearQuestionRecoveryTimeouts();
        this.setReadyForQuestions(true);
        this.setPhase("countdown", message.data);
        this.emitCountdownStarted(message.data);
        this.scheduleQuestionRecoveryAfterCountdown(message.data);
        break;

      case "preload_question":
        break;

      case "beat_clock_started":
        this.rememberGameType(message.data);
        this.questionReceived = false;
        this.lastQuestion = null;
        this.pendingQuestions = [];
        this.clearQuestionRecoveryTimeouts();
        this.setReadyForQuestions(true);
        this.setPhase("question", message.data);
        this.onBeatClockStateUpdate?.(message.data ?? {});
        this.scheduleQuestionRecovery("beat_clock_started", [250, 1000, 2000]);
        break;

      case "beat_clock_question":
        this.rememberGameType(message.data);
        this.questionReceived = false;
        this.clearQuestionRecoveryTimeouts();
        this.setReadyForQuestions(true);
        this.setPhase("question", this.withStableGameType(message.data));
        this.emitFairPlayFromState(message.data);
        if (message.data) {
          const questionData = this.withStableGameType(message.data);
          setTimeout(() => {
            this.deliverOrBufferQuestion(questionData, "beat_clock_question");
          }, 75);
        }
        break;

      case "beat_clock_answer_result":
        this.onBeatClockAnswerResult?.(message.data ?? {});
        break;

      case "beat_clock_state":
        this.onBeatClockStateUpdate?.(message.data ?? {});
        break;

      case "question_started":
        console.log("MOBILE RECEIVED question_started", message.data);
        if (this.shouldIgnoreGenericQuestion(message.data)) {
          console.log(
            "Ignoring generic question_started during Beat the Clock session",
            message.data,
          );
          this.scheduleQuestionRecovery("ignored_generic_question_started", [
            250,
            1000,
            2000,
          ]);
          break;
        }
        this.rememberGameType(message.data);
        this.questionReceived = false;
        this.clearQuestionRecoveryTimeouts();
        this.setReadyForQuestions(true);
        if (message.data) {
          const revealDelay = message.data.start_at
            ? this.getDelayUntilServerTime(message.data.start_at)
            : 0;
          this.scheduleAtServerTime(message.data.start_at, () => {
            this.setPhase("question", message.data);
            this.deliverOrBufferQuestion(message.data, "question_started");
          });
          this.scheduleQuestionRecovery("question_started", [
            revealDelay + 500,
            revealDelay + 1500,
            revealDelay + 3000,
          ]);
        } else {
          this.scheduleQuestionRecovery("empty_question_started");
        }
        break;

      case "current_question":
      case "question":
        if (this.shouldIgnoreGenericQuestion(message.data)) {
          console.log(
            `Ignoring generic ${message.type} during Beat the Clock session`,
            message.data,
          );
          this.scheduleQuestionRecovery(`ignored_generic_${message.type}`, [
            250,
            1000,
            2000,
          ]);
          break;
        }
        this.rememberGameType(message.data);
        if (this.currentPhase === "question" && message.data) {
          this.deliverOrBufferQuestion(message.data, message.type);
        }
        break;

      case "game_status_update":
        if (message.data) {
          this.rememberGameType(message.data);
          const stableData = this.withStableGameType(message.data);
          this.onGameStateUpdate?.(stableData);
          this.emitFairPlayFromState(stableData);
        }
        break;

      case "fair_play_settings_updated":
        this.onFairPlaySettingsUpdate?.(message.data ?? {});
        break;

      case "fair_play_status_update":
      case "player_flagged":
        if (this.isOwnKickedPayload(message.data)) {
          this.handleKickedFromSession(message.data ?? {}, message.type);
          break;
        }

        this.onFairPlayStatusUpdate?.({
          ...(message.data ?? {}),
          event_type: message.type,
        });
        break;

      case "fair_play_question_reset":
        this.emitFairPlayQuestionReset(
          message.data?.question_id ?? message.data?.questionId,
          message.type,
        );
        break;

      case "fair_play_focus_grace_started":
        this.onFairPlayStatusUpdate?.({
          ...(message.data ?? {}),
          event_type: message.type,
        });
        break;

      case "kicked_from_session":
        this.handleKickedFromSession(message.data ?? {}, message.type);
        break;

      case "game_ended":
        this.lastQuestion = null;
        this.pendingQuestions = [];
        this.setPhase("ended", message.data);
        this.onFairPlayStatusRefreshRequested?.();
        this.onGameEnded?.(message.data);
        break;

      case "answer_submitted":
      case "player_answered":
        this.onAnswerSubmitted?.({
          ...(message.data ?? {}),
          event_type: message.type,
        });
        break;

      case "answer_rejected":
      case "buzzer_rejected":
        this.handleRejectedPlayerAction(message.type, message.data ?? {});
        break;

      case "ui_update":
      case "buzzer_winner":
      case "correct_answer":
      case "incorrect_answer":
      case "buzzer_state_update":
      case "question_failed":
      case "question_ended":
      case "buzzer_reset":
      case "next_question":
        console.log("WebSocket buzzer/UI event received:", {
          messageType: message.type,
          dataType: message.data?.type,
          buttonState: message.data?.button_state ?? message.data?.buttonState,
          questionId:
            message.data?.question_id ??
            message.data?.questionId ??
            message.data?.question?.question_id ??
            message.data?.question?.questionId,
          isCurrentPlayer:
            message.data?.is_current_player ?? message.data?.isCurrentPlayer,
        });

        this.onBuzzerUpdate?.({
          ...(message.data ?? {}),
          event_type: message.type,
          type: message.data?.type ?? message.type,
        });
        break;

      case "pong":
        this.updateServerOffset(message.data?.serverTime ?? message.serverTime);
        break;

      case "player_kicked":
        if (this.isOwnKickedPayload(message.data)) {
          this.handleKickedFromSession(message.data ?? {}, message.type);
        } else {
          this.onFairPlayStatusUpdate?.({
            ...(message.data ?? {}),
            is_kicked: true,
            event_type: message.type,
          });
        }
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
    this.rememberGameType(state);

    const gameState = this.withStableGameType({
      ...(state.game_state ?? {}),
      ...state,
    });
    this.rememberGameType(gameState);
    this.onGameStateUpdate?.(gameState);
    this.emitFairPlayFromState(gameState);

    const phase = this.normalizePhase(gameState);

    if (phase !== "lobby" && phase !== "waiting") {
      this.setReadyForQuestions(true);
    } else {
      this.setReadyForQuestions(false);
    }

    if (phase !== "question") {
      this.clearScheduledQuestionStart();
      this.setPhase(phase, gameState);
    }

    if (phase === "countdown") {
      this.emitCountdownStarted(gameState);
      return;
    }

    if (phase === "question") {
      const question = gameState.current_question ?? gameState.question;

      if (this.hasQuestionPayload(question)) {
        if (this.shouldIgnoreGenericQuestion(question)) {
          console.log(
            "Ignoring generic authoritative question during Beat the Clock session",
            question,
          );
          this.requestCurrentQuestion();
          this.scheduleQuestionRecovery("ignored_generic_authoritative_state", [
            500,
            1500,
            3000,
          ]);
          return;
        }
        this.scheduleAtServerTime(question.start_at, () => {
          this.setPhase("question", question);
          this.deliverOrBufferQuestion(question, "authoritative_state");
        });
      } else {
        this.setPhase("question", gameState);
        this.requestCurrentQuestion();
        this.scheduleQuestionRecovery("sync_state_question", [500, 1500, 3000]);
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
    if (
      this.hasQuestionPayload(state?.current_question) ||
      this.hasQuestionPayload(state?.question)
    ) {
      return "question";
    }
    if (state?.question_start_at) return "countdown";
    if (state?.is_active || state?.isstarted) return "waiting";

    return "lobby";
  }

  private hasQuestionPayload(question: any): boolean {
    return !!question && (!!question.question_id || !!question.question);
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

  private emitFairPlayFromState(state: any): void {
    const settings =
      state?.fair_play_settings ??
      state?.fairPlaySettings ??
      state?.fair_play ??
      state?.fairPlay;
    const hasLegacySetting =
      typeof state?.fair_play_enabled === "boolean" ||
      typeof state?.cheat_detection_enabled === "boolean";

    if (settings || hasLegacySetting) {
      this.onFairPlaySettingsUpdate?.(settings ?? state);
    }

    const playerStatus =
      state?.fair_play_status ??
      state?.fairPlayStatus ??
      state?.player_fair_play_status ??
      state?.playerFairPlayStatus;

    if (playerStatus) {
      this.onFairPlayStatusUpdate?.(playerStatus);
    }
  }

  private emitFairPlayQuestionReset(
    questionId: string | undefined,
    eventType: string,
  ): void {
    this.onFairPlayStatusUpdate?.({
      player_id: this.playerInfo?.player_id,
      question_id: questionId,
      is_frozen: false,
      isFrozen: false,
      frozen_question_id: undefined,
      frozenQuestionId: undefined,
      answer_status: undefined,
      message: undefined,
      event_type: eventType,
    });
  }

  private handleRejectedPlayerAction(type: string, data: any): void {
    const rejectedData = {
      ...data,
      event_type: type,
    };

    const isBeatClockRejection =
      this.isBeatClockGameType(data) ||
      this.isBeatClockGameType(this.lastQuestion);
    if (
      type === "answer_rejected" &&
      isBeatClockRejection &&
      (data?.reason === "stale_question" ||
        data?.reason === "question_not_active")
    ) {
      this.onBeatClockAnswerResult?.({
        ...rejectedData,
        ignored: true,
        score: data?.score ?? this.lastQuestion?.score ?? 0,
        answered_count:
          data?.answered_count ?? this.lastQuestion?.answered_count ?? 0,
        correct_count:
          data?.correct_count ?? this.lastQuestion?.correct_count ?? 0,
        ends_at: data?.ends_at ?? this.lastQuestion?.ends_at,
      });
      return;
    }

    if (data?.reason === "fair_play_restriction") {
      this.onFairPlayStatusUpdate?.({
        player_id: this.playerInfo?.player_id,
        question_id: data.question_id,
        strike_count: data.strike_count,
        max_strikes: data.max_strikes,
        is_frozen: true,
        frozen_question_id: data.question_id,
        reason: data.reason,
        message:
          data.message ||
          "You are frozen for this question because of Fair Play Mode.",
        event_type: type,
      });
    }

    this.onAnswerRejected?.(rejectedData);
  }

  private getPayloadNumber(data: any, keys: string[]): number | undefined {
    const rawValue = keys
      .map((key) => data?.[key])
      .find((value) => value !== undefined && value !== null);

    if (rawValue === undefined) {
      return undefined;
    }

    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  }

  private hasReachedStrikeLimit(data: any): boolean {
    const strikeCount = this.getPayloadNumber(data, [
      "strike_count",
      "strikeCount",
      "fair_play_strikes",
      "fairPlayStrikes",
      "fair_play_strike_count",
      "fairPlayStrikeCount",
      "current_strikes",
      "currentStrikes",
      "strikes",
    ]);
    const maxStrikes = this.getPayloadNumber(data, [
      "max_strikes",
      "maxStrikes",
      "max_fair_play_strikes",
      "maxFairPlayStrikes",
      "max_cheat_strikes",
      "maxCheatStrikes",
      "strike_limit",
      "strikeLimit",
    ]);

    return (
      strikeCount !== undefined &&
      maxStrikes !== undefined &&
      maxStrikes > 0 &&
      strikeCount >= maxStrikes
    );
  }

  private isOwnKickedPayload(data: any): boolean {
    if (!data) {
      return false;
    }

    const playerId = data.player_id ?? data.playerId ?? data.participant_id;
    const isKicked =
      data.is_kicked === true ||
      data.isKicked === true ||
      data.answer_status === "kicked" ||
      data.reason === "fair_play_strikes" ||
      this.hasReachedStrikeLimit(data);

    if (!isKicked) {
      return false;
    }

    return (
      !playerId ||
      String(playerId).trim() ===
        String(this.playerInfo?.player_id ?? "").trim()
    );
  }

  private handleKickedFromSession(
    data: any,
    eventType: string,
    closeSocket = true,
  ): void {
    this.shouldReconnect = false;
    const kickedPayload = {
      ...data,
      is_kicked: true,
      event_type: eventType,
    };

    this.onFairPlayStatusUpdate?.(kickedPayload);
    this.onKickedFromSession?.(kickedPayload);

    if (closeSocket) {
      try {
        this.ws?.close(1000, "Kicked from session");
      } catch {
        // Ignore close failures; the UI already has the authoritative event.
      }
    }
  }

  private deliverOrBufferQuestion(questionData: any, source: string): void {
    if (!questionData) {
      return;
    }

    this.questionReceived = true;
    this.clearQuestionRecoveryTimeouts();
    const questionId = questionData.question_id ?? questionData.questionId;
    const inferredGameType = String(questionId ?? "")
      .toUpperCase()
      .startsWith("BTC")
      ? "beat_the_clock"
      : questionData.game_type || questionData.gameType || "trivia";

    const question: GameQuestion = {
      ui_mode: questionData.ui_mode || "multiple_choice",
      ...questionData,
      game_type: inferredGameType,
    };
    const isNewQuestion =
      !!question.question_id &&
      question.question_id !== this.lastQuestion?.question_id;

    if (isNewQuestion) {
      this.emitFairPlayQuestionReset(
        question.question_id,
        `${source}_fair_play_reset`,
      );
    }

    this.lastQuestion = question;

    if (this.isReadyForQuestions && this._onQuestionReceived) {
      this._onQuestionReceived(question);
      return;
    }

    console.log(`Buffering question from ${source}`);
    this.pendingQuestions = [question];
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

  private scheduleQuestionRecoveryAfterCountdown(data: any): void {
    const questionStartAt = data?.question_start_at;
    const durationMs =
      typeof data?.duration_ms === "number" ? data.duration_ms : 3000;
    const delay =
      typeof questionStartAt === "string"
        ? this.getDelayUntilServerTime(questionStartAt)
        : durationMs;

    this.scheduleQuestionRecovery("countdown_started", [
      delay + 500,
      delay + 1500,
      delay + 3000,
    ]);
  }

  private clearQuestionRecoveryTimeouts(): void {
    this.questionRecoveryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.questionRecoveryTimeouts = [];
  }

  private scheduleAtServerTime(
    startAtIso: string | undefined,
    callback: () => void,
  ): void {
    this.clearScheduledQuestionStart();

    if (!startAtIso) {
      callback();
      return;
    }

    const delay = this.getDelayUntilServerTime(startAtIso);
    this.questionStartTimeout = setTimeout(() => {
      this.questionStartTimeout = null;
      callback();
    }, delay);
  }

  private clearScheduledQuestionStart(): void {
    if (!this.questionStartTimeout) {
      return;
    }

    clearTimeout(this.questionStartTimeout);
    this.questionStartTimeout = null;
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

  private flushPendingFairPlayReturns(): void {
    if (this.pendingFairPlayReturns.size === 0) {
      return;
    }

    for (const [questionId, returnedAt] of this.pendingFairPlayReturns) {
      const sent = this.sendMessage({
        type: "fair_play_focus_returned",
        data: {
          session_code: this.sessionCode,
          player_id: this.playerInfo?.player_id,
          question_id: questionId,
          returned_at: returnedAt,
          flushed_after_reconnect: true,
        },
      });

      if (sent) {
        this.pendingFairPlayReturns.delete(questionId);
      }
    }
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
      if (
        !this.isConnected ||
        !this.ws ||
        this.ws.readyState !== WebSocket.OPEN
      ) {
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

      if (!this.sessionCode || !this.playerInfo || !this.shouldReconnect) {
        return;
      }

      if (this.cachedWebSocketUrl) {
        this.isConnecting = true;
        this.setConnectionState("reconnecting");
        this.openWebSocket(this.cachedWebSocketUrl);
        return;
      }

      this.connect(this.sessionCode, this.playerInfo);
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
    this.rosterPlayerId = null;
    this.isConnected = false;
    this.clearScheduledQuestionStart();
    this.pendingQuestions = [];
    this.lastQuestion = null;
    this.pendingGameStarted = [];
    this.pendingFairPlayReturns.clear();
    this.isReadyForQuestions = false;
    this.questionReceived = false;
    this.knownGameType = null;
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

  private async buildWebSocketUrl(
    backendUrl: string | undefined,
    sessionCode: string,
    playerInfo: PlayerInfo,
  ): Promise<string> {
    const baseUrl =
      backendUrl || `${this.getWebSocketBaseUrl()}/ws/session/${sessionCode}`;
    const params = new URLSearchParams();
    const token = await getToken();

    params.append("client_type", "mobile");
    params.append("player_name", playerInfo.player_name);
    if (token) {
      params.append("token", token);
    }

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
