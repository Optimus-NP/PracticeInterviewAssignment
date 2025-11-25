import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import InterviewSessionModel from '../models/InterviewSession.js';
import LLMService from '../services/LLMService.js';
import { 
  CreateSessionRequest, 
  SendMessageRequest, 
  SessionResponse,
  AgenticPromptContext,
  SessionState 
} from '../types/InterviewTypes.js';

export class InterviewController {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
  }

  // Create a new interview session
  createSession = async (req: Request<{}, SessionResponse, CreateSessionRequest>, res: Response): Promise<void> => {
    try {
      const {
        candidateName,
        candidateEmail,
        role,
        seniority,
        interviewTypes,
        company = 'Generic',
        jobDescription,
        durationMinutes = 30,
        questionFamiliarity = 'mixed'
      } = req.body;

      // Validate required fields
      if (!role || !seniority || !interviewTypes || interviewTypes.length === 0) {
        res.status(400).json({
          error: 'Missing required fields: role, seniority, and interviewTypes are required'
        });
        return;
      }

      // Test LLM service connection
      const isConnected = await this.llmService.testConnection();
      if (!isConnected) {
        res.status(503).json({
          error: 'AI service is currently unavailable. Please check your LLM configuration.'
        });
        return;
      }

      const sessionId = uuidv4();
      const now = new Date();

      // Create session configuration
      const config = {
        role: role as any,
        seniority: seniority as any,
        interviewTypes: interviewTypes as any[],
        company,
        jobDescription,
        durationMinutes,
        questionFamiliarity: questionFamiliarity as any,
        interviewMode: (req.body as any).interviewMode || 'mock'
      };

      // Create initial session state
      const state: SessionState = {
        phase: 'warmup',
        currentQuestionIndex: 0,
        questionsAsked: 0,
        startTime: now,
        lastActivity: now,
        isActive: true
      };

      // Generate initial question using AI
      const initialQuestion = await this.llmService.generateInitialQuestion(config, candidateName);

      // Create new session document
      const session = new InterviewSessionModel({
        sessionId,
        candidateName,
        candidateEmail,
        config,
        state,
        messages: [{
          role: 'assistant',
          content: initialQuestion,
          timestamp: now
        }],
        agenticDecisions: [],
        createdAt: now,
        updatedAt: now
      });

      await session.save();

      res.status(201).json({
        sessionId,
        message: initialQuestion,
        state,
        evaluation: undefined
      });

    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({
        error: 'Failed to create interview session'
      });
    }
  };

  // Send message and get AI response
  sendMessage = async (req: Request<{}, SessionResponse, SendMessageRequest>, res: Response): Promise<void> => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        res.status(400).json({
          error: 'Missing required fields: sessionId and message are required'
        });
        return;
      }

      // Find the session
      const session = await InterviewSessionModel.findOne({ sessionId });
      if (!session) {
        res.status(404).json({
          error: 'Interview session not found'
        });
        return;
      }

      if (!session.state.isActive) {
        res.status(400).json({
          error: 'Interview session has ended'
        });
        return;
      }

      const now = new Date();

      // Add user message to conversation
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: now
      } as any);

      // Update session activity
      session.state.lastActivity = now;
      session.state.questionsAsked += 1;

      // Create context for agentic decision making
      const context: AgenticPromptContext = {
        config: session.config,
        state: session.state,
        recentMessages: session.messages.slice(-5), // Last 5 messages for quick context
        questionHistory: session.messages
          .filter(msg => msg.role === 'assistant')
          .map(msg => msg.content),
        fullConversationHistory: session.messages // Full history for wrap-up and evaluations
      };

      let aiResponse: string = '';
      let practiceEvaluation: any = null;
      let shouldEndSession = false;

      // First, analyze response for appropriateness and relevance
      const lastQuestion = session.messages
        .filter(msg => msg.role === 'assistant')
        .pop()?.content || 'Previous question';

      // Track warning count
      const warningCount = session.agenticDecisions 
        ? session.agenticDecisions.filter(d => d.decision === 'MODERATE').length 
        : 0;

      // Get recent conversation history for context
      const recentHistory = session.messages
        .slice(-6) // Last 3 exchanges (6 messages)
        .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
        .join('\n');

      // Use LLM for intelligent content moderation with full context
      console.log(`[MODERATION] Analyzing message: "${message.substring(0, 50)}..."`);
      const contentAnalysis = await this.llmService.analyzeResponseApproppriateness(
        message, 
        lastQuestion,
        warningCount,
        recentHistory
      );
      console.log('[MODERATION] Analysis result:', JSON.stringify(contentAnalysis, null, 2));

      // Handle inappropriate content or off-topic responses
      if (!contentAnalysis.isAppropriate || contentAnalysis.containsProfanity) {
        console.log('[MODERATION] TRIGGERED - Handling inappropriate content');
        const moderationResponse = await this.llmService.generateModerationResponse(
          contentAnalysis,
          warningCount,
          lastQuestion
        );

        if (moderationResponse.shouldTerminate) {
          session.state.isActive = false;
          session.state.endTime = now;
          session.state.phase = 'completed';
          shouldEndSession = true;
          
          session.agenticDecisions.push({
            timestamp: now,
            decision: 'TERMINATE',
            reasoning: 'Session terminated due to inappropriate behavior',
            context: contentAnalysis.reason
          });

          aiResponse = moderationResponse.message;
        } else if (moderationResponse.message) {
          // Issue warning and redirect
          session.agenticDecisions.push({
            timestamp: now,
            decision: 'MODERATE',
            reasoning: 'Inappropriate or off-topic response detected',
            context: contentAnalysis.reason
          });

          aiResponse = moderationResponse.message;
        }
      } else {
        // Handle Practice Mode vs Mock Interview Mode for appropriate responses
        if (session.config.interviewMode === 'practice') {
          // Practice Mode: Provide immediate feedback and sample answers
          const feedbackText = await this.llmService.generatePracticeFeedback(
            session.config,
            lastQuestion,
            message
          );

          try {
            practiceEvaluation = JSON.parse(feedbackText);
            aiResponse = `Your Score: ${practiceEvaluation.score}/5

Feedback: ${practiceEvaluation.feedback}

Sample Answers:
1. ${practiceEvaluation.sampleAnswers[0]}
2. ${practiceEvaluation.sampleAnswers[1]}
3. ${practiceEvaluation.sampleAnswers[2]}
4. ${practiceEvaluation.sampleAnswers[3]}
5. ${practiceEvaluation.sampleAnswers[4]}

Improvements:
• ${practiceEvaluation.improvements[0]}
• ${practiceEvaluation.improvements[1]}
• ${practiceEvaluation.improvements[2]}

Next Question: ${practiceEvaluation.nextQuestion}`;

          } catch (error) {
            console.error('Failed to parse practice feedback:', error);
            aiResponse = "Great answer! Let me ask you the next question...";
          }

        } else {
          // Mock Interview Mode: Use existing agentic behavior
          const decision = await this.llmService.makeAgenticDecision(context);
          session.agenticDecisions.push(decision);

          // Log the decision for debugging
          const elapsedMinutes = session.state.startTime 
            ? (Date.now() - session.state.startTime.getTime()) / (1000 * 60)
            : 0;
          console.log(`[AGENTIC] Decision: ${decision.decision}, Elapsed: ${elapsedMinutes.toFixed(1)}min, Questions: ${session.state.questionsAsked}, Reasoning: ${decision.reasoning}`);

          let newPhase = session.state.phase;

          // Handle different decisions
          switch (decision.decision) {
            case 'WRAP_UP':
              // Calculate minimum requirements for wrap-up
              const minTimeElapsed = session.config.durationMinutes * 0.8; // 80% of time
              const minQuestions = Math.max(3, Math.ceil(session.config.durationMinutes / 5)); // At least 3 questions
              
              // Only allow wrap-up if BOTH time has passed AND enough questions asked
              const canWrapUp = elapsedMinutes >= minTimeElapsed && session.state.questionsAsked >= minQuestions;
              
              if (canWrapUp) {
                newPhase = 'wrap_up';
                aiResponse = await this.llmService.generateNextQuestion(decision, context, session.messages);
                shouldEndSession = true;
                console.log(`[AGENTIC] Wrapping up - Elapsed: ${elapsedMinutes.toFixed(1)}min of ${session.config.durationMinutes}min, Questions: ${session.state.questionsAsked}`);
              } else {
                // Override premature wrap-up decision
                console.log(`[AGENTIC] Overriding premature WRAP_UP - Only ${elapsedMinutes.toFixed(1)}min/${session.config.durationMinutes}min (need ${minTimeElapsed.toFixed(1)}min) and ${session.state.questionsAsked}/${minQuestions} questions`);
                newPhase = session.state.phase; // Stay in current phase
                aiResponse = await this.llmService.generateNextQuestion(
                  { ...decision, decision: 'MOVE_NEXT' },
                  context,
                  session.messages
                );
              }
              break;
            
            case 'CHANGE_PHASE':
              newPhase = this.getNextPhase(session.state.phase);
              session.state.phase = newPhase;
              aiResponse = await this.llmService.generateNextQuestion(decision, context, session.messages);
              break;
            
            default:
              aiResponse = await this.llmService.generateNextQuestion(decision, context, session.messages);
          }

          // Update session state for mock interview
          session.state.phase = newPhase;
        }
      }

      // Add AI response to conversation (using proper Mongoose syntax)
      session.messages.push({
        role: 'assistant' as const,
        content: aiResponse,
        timestamp: now,
        metadata: {
          questionType: session.state.phase,
          isFollowUp: session.config.interviewMode === 'practice',
          evaluationScore: practiceEvaluation?.score
        }
      } as any);

      // Check if interview should end
      const shouldEndInterview = shouldEndSession || this.shouldEndInterview(session.state, session.config.durationMinutes);
      
      if (shouldEndInterview) {
        session.state.isActive = false;
        session.state.endTime = now;
        session.state.phase = 'completed';

        // Generate evaluation only if not already terminated
        if (!shouldEndSession) {
          const evaluationText = await this.llmService.generateEvaluation(
            session.config,
            session.messages
          );

          try {
            const evaluation = JSON.parse(evaluationText);
            session.evaluation = evaluation;
          } catch (error) {
            console.error('Failed to parse evaluation JSON:', error);
            // Provide fallback evaluation
            session.evaluation = {
              overall: {
                score: 3,
                recommendation: 'Maybe',
                strengths: ['Participated in the interview'],
                improvements: ['Could provide more detailed responses'],
                detailedFeedback: 'Thank you for completing the mock interview. Please review the conversation for areas of improvement.'
              }
            };
          }
        }
      }

      await session.save();

      res.json({
        sessionId,
        message: aiResponse,
        state: session.state,
        evaluation: session.evaluation
      });

    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({
        error: 'Failed to process message'
      });
    }
  };

  // Get session details
  getSession = async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const session = await InterviewSessionModel.findOne({ sessionId });
      if (!session) {
        res.status(404).json({
          error: 'Interview session not found'
        });
        return;
      }

      res.json({
        sessionId: session.sessionId,
        candidateName: session.candidateName,
        config: session.config,
        state: session.state,
        messages: session.messages,
        evaluation: session.evaluation,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });

    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({
        error: 'Failed to fetch session'
      });
    }
  };

  // Get session evaluation
  getEvaluation = async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const session = await InterviewSessionModel.findOne({ sessionId });
      if (!session) {
        res.status(404).json({
          error: 'Interview session not found'
        });
        return;
      }

      if (!session.evaluation) {
        res.status(400).json({
          error: 'Evaluation not yet available. Complete the interview first.'
        });
        return;
      }

      res.json({
        sessionId,
        evaluation: session.evaluation,
        transcript: session.messages,
        config: session.config
      });

    } catch (error) {
      console.error('Error fetching evaluation:', error);
      res.status(500).json({
        error: 'Failed to fetch evaluation'
      });
    }
  };

  // Get role configuration data
  getRoleConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const roleConfig = {
        'Software Engineer': {
          seniorities: ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal', 'Distinguished'],
          interviewTypes: ['Behavioral', 'Technical', 'System Design', 'Coding']
        },
        'Product Manager': {
          seniorities: ['Associate PM', 'PM', 'Senior PM', 'Principal PM', 'Director', 'VP Product'],
          interviewTypes: ['Behavioral', 'Product Sense', 'Case Study', 'Strategy', 'Leadership']
        },
        'Sales Representative': {
          seniorities: ['Sales Associate', 'Account Executive', 'Senior AE', 'Territory Manager', 'Regional Manager', 'Country Manager', 'Global Head'],
          interviewTypes: ['Behavioral', 'Sales Roleplay', 'Case Study', 'Negotiation']
        },
        'Marketing Manager': {
          seniorities: ['Marketing Associate', 'Marketing Manager', 'Senior Manager', 'Director', 'VP Marketing', 'CMO'],
          interviewTypes: ['Behavioral', 'Case Study', 'Strategy', 'Campaign Planning', 'Leadership']
        },
        'Data Scientist': {
          seniorities: ['Junior Data Scientist', 'Data Scientist', 'Senior Data Scientist', 'Staff Data Scientist', 'Principal Data Scientist', 'Director'],
          interviewTypes: ['Behavioral', 'Technical', 'Case Study', 'Statistics & ML', 'Coding']
        },
        'Designer': {
          seniorities: ['Junior Designer', 'Product Designer', 'Senior Designer', 'Staff Designer', 'Principal Designer', 'Design Director'],
          interviewTypes: ['Behavioral', 'Portfolio Review', 'Design Challenge', 'Case Study']
        },
        'Consultant': {
          seniorities: ['Analyst', 'Associate', 'Senior Associate', 'Manager', 'Senior Manager', 'Principal', 'Partner'],
          interviewTypes: ['Behavioral', 'Case Study', 'Problem Solving', 'Client Interaction']
        },
        'Other': {
          seniorities: ['Entry Level', 'Mid Level', 'Senior Level', 'Leadership'],
          interviewTypes: ['Behavioral', 'Technical', 'Case Study']
        }
      };

      res.json(roleConfig);
    } catch (error) {
      console.error('Error fetching role config:', error);
      res.status(500).json({
        error: 'Failed to fetch role configuration'
      });
    }
  };

  // Health check for LLM service
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const isConnected = await this.llmService.testConnection();
      const serviceName = await this.llmService.getActiveServiceName();
      res.json({
        status: isConnected ? 'healthy' : 'unhealthy',
        llmService: serviceName,
        connected: isConnected,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: 'Health check failed'
      });
    }
  };

  // Helper methods
  private getNextPhase(currentPhase: string): SessionState['phase'] {
    const phases: SessionState['phase'][] = ['warmup', 'behavioral', 'technical', 'system_design', 'product', 'wrap_up'];
    const currentIndex = phases.indexOf(currentPhase as SessionState['phase']);
    return phases[currentIndex + 1] || 'wrap_up';
  }

  private shouldEndInterview(state: SessionState, durationMinutes: number): boolean {
    if (!state.startTime) return false;
    
    const elapsedMinutes = (Date.now() - state.startTime.getTime()) / (1000 * 60);
    const maxQuestions = Math.max(6, Math.min(12, Math.floor(durationMinutes / 4)));
    
    return elapsedMinutes >= durationMinutes || 
           state.questionsAsked >= maxQuestions ||
           state.phase === 'completed';
  }
}

export default InterviewController;
