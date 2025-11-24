import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
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

const sessionConfigSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Product Manager', 'Data Scientist', 'Sales Representative', 'Marketing Manager', 'Other']
  },
  seniority: {
    type: String,
    required: true,
    enum: ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal']
  },
  interviewTypes: [{
    type: String,
    enum: ['Behavioral', 'Technical', 'System Design', 'Product Sense', 'Case Study', 'Leadership']
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

const sessionStateSchema = new mongoose.Schema({
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

const evaluationSchema = new mongoose.Schema({
  communication: {
    score: { type: Number, min: 1, max: 5 },
    feedback: String
  },
  technicalDepth: {
    score: { type: Number, min: 1, max: 5 },
    feedback: String
  },
  problemSolving: {
    score: { type: Number, min: 1, max: 5 },
    feedback: String
  },
  leadership: {
    score: { type: Number, min: 1, max: 5 },
    feedback: String
  },
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

const interviewSessionSchema = new mongoose.Schema({
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
  agenticDecisions: [{
    timestamp: Date,
    decision: String,
    reasoning: String,
    context: String
  }],
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
interviewSessionSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Index for efficient queries
interviewSessionSchema.index({ sessionId: 1 });
interviewSessionSchema.index({ 'state.isActive': 1 });
interviewSessionSchema.index({ createdAt: -1 });

export default mongoose.model('InterviewSession', interviewSessionSchema);
