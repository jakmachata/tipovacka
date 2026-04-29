// Doménové typy odpovídající Postgres schématu

export type MatchStage =
  | "group" | "prelim" | "quarter" | "semi" | "bronze" | "final";

export const STAGE_LABEL: Record<MatchStage, string> = {
  group: "Skupina",
  prelim: "Předkolo",
  quarter: "Čtvrtfinále",
  semi: "Semifinále",
  bronze: "O bronz",
  final: "Finále",
};

export interface Profile {
  id: string;
  display_name: string;
  is_approved: boolean;
  is_admin: boolean;
  has_paid: boolean;
  created_at: string;
}

export interface Team {
  code: string;
  name_cs: string;
  flag_emoji: string | null;
}

export interface Match {
  id: number;
  game_no: number;
  starts_at: string;
  home_code: string;
  away_code: string;
  home_handicap: number | null;
  stage: MatchStage;
  is_czech: boolean;
  home_score: number | null;
  away_score: number | null;
  home_score_p1: number | null;
  away_score_p1: number | null;
  finalized: boolean;
  updated_at: string;
}

export interface Pick {
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  home_score_p1: number | null;
  away_score_p1: number | null;
  submitted_at: string;
}

export interface Score {
  user_id: string;
  match_id: number;
  hcp_points: number;
  exact_points: number;
  p1_points: number;
  total_points: number;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  hcp_total: number;
  exact_total: number;
  p1_total: number;
  total: number;
}
