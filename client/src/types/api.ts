// Shared types between frontend and backend
export interface SessionConfig {
  role: string;
  seniority: string;
  interviewTypes: string[];
  company?: string;
  jobDescription?: string;
  durationMinutes: number;
  questionFamiliarity: string;
}

export interface SessionState {
  phase: string;
  currentQuestionIndex: number;
  questionsAsked: number;
  startTime?: string;
  endTime?: string;
  lastActivity: string;
  isActive: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    questionType?: string;
    isFollowUp?: boolean;
    evaluationScore?: number;
  };
}

export interface EvaluationCriteria {
  score: number;
  feedback: string;
}

export interface Evaluation {
  communication?: EvaluationCriteria;
  technicalDepth?: EvaluationCriteria;
  problemSolving?: EvaluationCriteria;
  leadership?: EvaluationCriteria;
  overall?: {
    score: number;
    recommendation: 'Strong Hire' | 'Hire' | 'Maybe' | 'No Hire';
    strengths: string[];
    improvements: string[];
    detailedFeedback: string;
  };
}

export interface CreateSessionRequest {
  candidateName?: string;
  candidateEmail?: string;
  role: string;
  seniority: string;
  interviewTypes: string[];
  company?: string;
  jobDescription?: string;
  durationMinutes?: number;
  questionFamiliarity?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SessionResponse {
  sessionId: string;
  message: string;
  state: SessionState;
  evaluation?: Evaluation;
}

export interface InterviewSession {
  sessionId: string;
  candidateName?: string;
  config: SessionConfig;
  state: SessionState;
  messages: Message[];
  evaluation?: Evaluation;
  createdAt: string;
  updatedAt: string;
}
