export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface LevelOption {
  code: EnglishLevel;
  title: string;
  description: string;
  speedLabel: string;
  languageMode: 'es-supported' | 'en-only';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface SessionSummary {
  strengths: string[];
  improvements: string[];
  recommendation: string;
}

export type AppScreen = 'level-select' | 'conversation' | 'summary';
