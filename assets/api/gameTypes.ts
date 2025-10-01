// Game Session Types - matches backend models

export interface GameSession {
  session_code: string;
  host_name: string;
  number_of_questions: number;
  game_code: string;
  created_at?: string;
}

export interface Game {
  game_code: string;
  rules: string;
  genre: string;
  created_at?: string;
}

export interface SessionJoinInfo {
  session_code: string;
  host_name: string;
  game_code: string;
  number_of_questions: number;
  websocket_url: string;
  web_join_url: string;
}

export interface GameSessionState {
  session_code: string;
  is_active: boolean;
  is_waiting_for_players: boolean;
  isstarted: boolean;
  current_question_index: number;
  total_questions: number;
  current_question: {
    question_id: string | null;
    question: string | null;
    genre: string | null;
  };
  players: {
    total: number;
    answered: number;
    waiting_for: number;
  };
  started_at: string | null;
  ended_at: string | null;
}

export interface GameQuestion {
  question_id: string;
  question: string;
  genre: string;
  options?: string[]; // For multiple choice questions
  correct_answer?: string;
  ui_mode?: "multiple_choice" | "buzzer" | "text_input";
}

export interface PlayerResponse {
  response_id: string;
  session_code: string;
  player_id: string;
  question_id: string;
  player_answer: string;
  is_correct: boolean;
  answered_at: string;
}

export interface SessionScore {
  score_id: string;
  session_code: string;
  player_id: string;
  score: number;
  result?: "win" | "lose" | "draw";
}

export interface SubmitAnswerResponse {
  message: string;
  is_correct: boolean;
  correct_answer?: string;
  current_score: number;
  game_state: "question_answered" | "question_complete" | "game_complete";
  next_question?: GameQuestion;
  final_results?: SessionScore[];
}

export interface SessionAssignment {
  assignment_id: string;
  player_id: string;
  session_code: string;
  session_start: string;
  session_end?: string;
}

export interface GameJoinRequest {
  session_code: string;
  player_id: string;
}

export interface GameSessionCreation {
  host_name: string;
  number_of_questions: number;
  game_code: string;
}

export interface GameCreation {
  rules: string;
  genre: string;
}
