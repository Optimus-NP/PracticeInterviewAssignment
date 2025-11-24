import mongoose, { Schema, Document } from 'mongoose';
import { InterviewSession, Message, SessionConfig, SessionState, Evaluation, AgenticDecision } from '../types/InterviewTypes.js';

// Mongoose document interfaces
export interface IMessage extends Document {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    questionType?: string;
    isFollowUp?: boolean;
    evaluationScore?: number;
  };
}

export interface IInterviewSession extends Document {
  sessionId: string;
  candidateName?: string;
  candidateEmail?: string;
  config: SessionConfig;
  state: SessionState;
  messages: IMessage[];
  evaluation?: Evaluation;
  agenticDecisions: AgenticDecision[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    questionType: String,
    isFollowUp: Boolean,
    evaluationScore: Number
  }
});

const sessionConfigSchema = new Schema<SessionConfig>({
  role: {
    type: String,
    required: true,
    enum: ['Software Engineer', 'Product Manager', 'Sales Representative', 'Marketing Manager', 'Data Scientist', 'Designer', 'Consultant', 'Other']
  },
  seniority: {
    type: String,
    required: true,
    enum: [
      // Software Engineer
      'Intern', 'Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal', 'Distinguished',
      // Product Manager
      'Associate PM', 'PM', 'Senior PM', 'Principal PM', 'Director', 'VP Product',
      // Sales Representative
      'Sales Associate', 'Account Executive', 'Senior AE', 'Territory Manager', 'Regional Manager', 'Country Manager', 'Global Head',
      // Marketing Manager
      'Marketing Associate', 'Marketing Manager', 'Senior Manager', 'VP Marketing', 'CMO',
      // Data Scientist
      'Junior Data Scientist', 'Data Scientist', 'Senior Data Scientist', 'Staff Data Scientist', 'Principal Data Scientist',
      // Designer
      'Junior Designer', 'Product Designer', 'Senior Designer', 'Staff Designer', 'Principal Designer', 'Design Director',
      // Consultant
      'Analyst', 'Associate', 'Senior Associate', 'Manager', 'Senior Manager',
      // Generic
      'Entry Level', 'Mid Level', 'Senior Level', 'Leadership'
    ]
  },
  interviewTypes: [{
    type: String,
    enum: [
      'Behavioral', 'Technical', 'System Design', 'Product Sense', 'Case Study', 'Leadership',
      'Coding', 'Sales Roleplay', 'Negotiation', 'Strategy', 'Campaign Planning', 
      'Statistics & ML', 'Portfolio Review', 'Design Challenge', 'Problem Solving', 
      'Client Interaction'
    ]
  }],
  company: {
    type: String,
    default: 'Generic'
  },
  jobDescription: String,
  durationMinutes: {
    type: Number,
    default: 30
  },
  questionFamiliarity: {
    type: String,
    enum: ['known', 'mixed', 'unique'],
    default: 'mixed'
  }
});

const sessionStateSchema = new Schema<SessionState>({
  phase: {
    type: String,
    enum: ['setup', 'warmup', 'behavioral', 'technical', 'system_design', 'product', 'wrap_up', 'completed'],
    default: 'setup'
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  questionsAsked: {
    type: Number,
    default: 0
  },
  startTime: Date,
  endTime: Date,
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const evaluationCriteriaSchema = new Schema({
  score: { type: Number, min: 1, max: 5 },
  feedback: String
});

const evaluationSchema = new Schema<Evaluation>({
  communication: evaluationCriteriaSchema,
  technicalDepth: evaluationCriteriaSchema,
  problemSolving: evaluationCriteriaSchema,
  leadership: evaluationCriteriaSchema,
  overall: {
    score: { type: Number, min: 1, max: 5 },
    recommendation: {
      type: String,
      enum: ['Strong Hire', 'Hire', 'Maybe', 'No Hire']
    },
    strengths: [String],
    improvements: [String],
    detailedFeedback: String
  }
});

const agenticDecisionSchema = new Schema<AgenticDecision>({
  timestamp: {
    type: Date,
    default: Date.now
  },
  decision: {
    type: String,
    required: true
  },
  reasoning: {
    type: String,
    required: true
  },
  context: {
    type: String,
    required: true
  }
});

const interviewSessionSchema = new Schema<IInterviewSession>({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  candidateName: String,
  candidateEmail: String,
  config: {
    type: sessionConfigSchema,
    required: true
  },
  state: {
    type: sessionStateSchema,
    required: true
  },
  messages: [messageSchema],
  evaluation: evaluationSchema,
  agenticDecisions: [agenticDecisionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
interviewSessionSchema.pre('save', function(this: IInterviewSession) {
  this.updatedAt = new Date();
});

// Index for efficient queries
interviewSessionSchema.index({ sessionId: 1 });
interviewSessionSchema.index({ 'state.isActive': 1 });
interviewSessionSchema.index({ createdAt: -1 });

// Static methods for the model
interviewSessionSchema.statics.findBySessionId = function(sessionId: string) {
  return this.findOne({ sessionId });
};

interviewSessionSchema.statics.findActiveSessions = function() {
  return this.find({ 'state.isActive': true });
};

export const InterviewSessionModel = mongoose.model<IInterviewSession>('InterviewSession', interviewSessionSchema);

export default InterviewSessionModel;
