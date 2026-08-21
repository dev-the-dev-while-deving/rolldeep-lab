export type TopicStatus = "available" | "rolled" | "in_progress" | "completed";

export type Topic = {
  id: string;
  syllabusId: string | null;
  title: string;
  question: string;
  minutes: number;
  stars: number;
  sourceExcerpt: string | null;
  status: TopicStatus;
  rolledAt: number | null;
  completedAt: number | null;
  videoUrl: string | null;
  notes: string | null;
  createdAt: number;
};

export type NewUnit = {
  title: string;
  question: string;
  minutes: number;
  stars?: number;
  sourceExcerpt?: string;
};

export type SyllabusRecord = {
  id: string;
  title: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
  createdAt: number;
  unitCount: number;
};

export type LabStatus = {
  available: number;
  completed: number;
  currentStreak: number;
  lastRollDate: string | null;
  timezone: string;
  inProgress: Topic | null;
  current: Topic | null;
  previous: Topic[];
  rollsUsed: number;
  rollsLeft: number;
  homeDir: string;
};

export type CompleteInput = {
  notes?: string;
  videoUrl?: string;
};

export type AddUnitsResult = {
  syllabusId: string;
  added: number;
  skipped: number;
};
