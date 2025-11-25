export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    questionType?: string;
    isFollowUp?: boolean;
    evaluationScore?: number;
  };
}

export interface SessionConfig {
  role: 'Software Engineer' | 'Product Manager' | 'Sales Representative' | 'Marketing Manager' | 'Data Scientist' | 'Designer' | 'Consultant' | 'Other';
  seniority: string; // Dynamic based on role
  interviewTypes: Array<string>; // Dynamic based on role
  company?: string;
  jobDescription?: string;
  durationMinutes: number;
  questionFamiliarity: 'known' | 'mixed' | 'unique';
  interviewMode: 'practice' | 'mock'; // NEW: Practice vs Mock Interview mode
}

export interface PracticeEvaluation {
  score: number; // 1-5 for this specific response
  feedback: string;
  sampleAnswers: string[];
  improvements: string[];
  nextQuestion: string;
}

export interface SessionState {
  phase: 'setup' | 'warmup' | 'behavioral' | 'technical' | 'system_design' | 'product' | 'wrap_up' | 'completed';
  currentQuestionIndex: number;
  questionsAsked: number;
  startTime?: Date;
  endTime?: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface EvaluationCriteria {
  score: number; // 1-5
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

export interface AgenticDecision {
  timestamp: Date;
  decision: string;
  reasoning: string;
  context: string;
}

export interface InterviewSession {
  sessionId: string;
  candidateName?: string;
  candidateEmail?: string;
  config: SessionConfig;
  state: SessionState;
  messages: Message[];
  evaluation?: Evaluation;
  agenticDecisions: AgenticDecision[];
  createdAt: Date;
  updatedAt: Date;
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

export interface OllamaResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
}

export interface InterviewPlan {
  role: string;
  seniority: string;
  evaluationCategories: {
    name: string;
    description: string;
    weight: number; // 0-1, sum should be 1
    keyCompetencies: string[];
  }[];
  seniorityExpectations: {
    depth: string;
    complexity: string;
    leadership: string;
    independence: string;
  };
  interviewPhases: {
    phase: string;
    duration: number; // in minutes
    focusAreas: string[];
    sampleQuestions: string[];
  }[];
  scoringRubric: {
    score: number;
    description: string;
    expectations: string[];
  }[];
  hiringRecommendationGuidelines: {
    strongHire: string;
    hire: string;
    maybe: string;
    noHire: string;
  };
  generatedAt: Date;
}

export interface ConversationSummary {
  timestamp: Date;
  questionsAsked: number;
  keyPoints: string[];
  candidateStrengths: string[];
  areasToProbe: string[];
}

export interface AgenticPromptContext {
  config: SessionConfig;
  state: SessionState;
  recentMessages: Message[];
  questionHistory: string[];
  interviewPlan?: InterviewPlan;
  conversationSummary?: ConversationSummary; // Summarized history to reduce context
  fullConversationHistory?: Message[]; // Full history for important decisions
}
