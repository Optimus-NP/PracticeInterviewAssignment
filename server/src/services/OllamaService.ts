import { Ollama } from '@langchain/community/llms/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { AgenticPromptContext, SessionConfig, SessionState, Message, AgenticDecision, InterviewPlan } from '../types/InterviewTypes.js';
import { ILLMService } from './LLMService.js';
import InterviewPrompts from '../prompts/InterviewPrompts.js';
import axios from 'axios';

export class OllamaService implements ILLMService {
  private llm: Ollama;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2:7b';
    
    this.llm = new Ollama({
      baseUrl: this.baseUrl,
      model: this.model,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
    });
  }

  // Test connection to Ollama
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.status === 200;
    } catch (error) {
      console.error('Ollama connection failed:', error);
      return false;
    }
  }

  // Generate comprehensive interview plan tailored to role and seniority
  async generateInterviewPlan(config: SessionConfig): Promise<InterviewPlan> {
    const promptText = InterviewPrompts.generateInterviewPlan(config);
    const response = await this.llm.invoke(promptText);
    
    try {
      const planData = JSON.parse(response);
      return {
        ...planData,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error parsing interview plan:', error);
      throw new Error('Failed to generate interview plan');
    }
  }

  // Generate initial interview question based on config
  async generateInitialQuestion(config: SessionConfig, candidateName?: string): Promise<string> {
    const promptText = InterviewPrompts.generateInitialQuestion(config, candidateName);
    return await this.llm.invoke(promptText);
  }

  // Check for inappropriate content using LLM
  async analyzeResponseApproppriateness(
    response: string, 
    question: string,
    previousWarnings: number = 0,
    recentHistory?: string
  ): Promise<{
    isAppropriate: boolean;
    isOnTopic: boolean;
    containsProfanity: boolean;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }> {
    try {
      // Use LLM for intelligent content moderation
      const promptText = InterviewPrompts.analyzeContentModeration(response, question, previousWarnings, recentHistory);
      const moderationResult = await this.llm.invoke(promptText);
      
      const analysis = JSON.parse(moderationResult);
      
      // Log if inappropriate content detected
      if (!analysis.isAppropriate || analysis.containsProfanity || analysis.isAbusive) {
        console.log('[MODERATION] Inappropriate content detected:', {
          reason: analysis.reason,
          flaggedWords: analysis.flaggedWords,
          severity: analysis.severity
        });
      }
      
      return {
        isAppropriate: analysis.isAppropriate && !analysis.containsProfanity && !analysis.isAbusive,
        isOnTopic: analysis.isOnTopic,
        containsProfanity: analysis.containsProfanity || analysis.isAbusive,
        severity: analysis.severity || 'low',
        reason: analysis.reason || 'Response appears appropriate'
      };
    } catch (error) {
      console.error('[MODERATION] Error analyzing content, defaulting to safe:', error);
      // Fallback: be conservative and flag if very short or suspicious
      const isSuspicious = response.trim().length < 5;
      return {
        isAppropriate: !isSuspicious,
        isOnTopic: !isSuspicious,
        containsProfanity: false,
        severity: isSuspicious ? 'medium' : 'low',
        reason: isSuspicious ? 'Very short response' : 'Unable to analyze, assumed appropriate'
      };
    }
  }

  // Generate response for handling inappropriate content
  async generateModerationResponse(
    analysis: any,
    warningCount: number,
    question: string
  ): Promise<{ message: string; shouldTerminate: boolean }> {
    if (analysis.containsProfanity || analysis.severity === 'high') {
      warningCount++;
      
      if (warningCount >= 2) {
        return {
          message: "I need to end our interview session here. Professional communication is required for interview practice. Thank you for your time.",
          shouldTerminate: true
        };
      } else {
        return {
          message: `I need you to maintain professional communication during our interview. This is your ${warningCount === 1 ? 'first' : 'second'} warning. Let's continue professionally. 

Let me repeat the question: ${question}`,
          shouldTerminate: false
        };
      }
    } else if (!analysis.isOnTopic) {
      return {
        message: `I notice your response isn't directly addressing the question I asked. Let me help redirect our conversation.

The question was: ${question}

Could you please provide a response that specifically addresses this question about your professional experience?`,
        shouldTerminate: false
      };
    }

    return { message: "", shouldTerminate: false };
  }

  // Implement agentic behavior - decide next action based on context
  async makeAgenticDecision(context: AgenticPromptContext): Promise<AgenticDecision> {
    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    
    // Calculate elapsed time
    const elapsedMinutes = context.state.startTime 
      ? (Date.now() - context.state.startTime.getTime()) / (1000 * 60)
      : 0;
    
    const promptText = InterviewPrompts.makeAgenticDecision(
      context.config,
      context.state.phase,
      context.state.questionsAsked,
      lastMessage?.content || 'No recent response',
      elapsedMinutes
    );

    const response = await this.llm.invoke(promptText);
    
    try {
      const decision = JSON.parse(response);
      return {
        timestamp: new Date(),
        decision: decision.decision,
        reasoning: decision.reasoning,
        context: decision.context
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        timestamp: new Date(),
        decision: 'MOVE_NEXT',
        reasoning: 'Default action due to parsing error',
        context: 'Failed to parse AI decision response'
      };
    }
  }

  // Generate next question based on agentic decision
  async generateNextQuestion(
    decision: AgenticDecision,
    context: AgenticPromptContext,
    conversationHistory: Message[]
  ): Promise<string> {
    let promptText: string;
    const lastResponse = conversationHistory[conversationHistory.length - 1]?.content || '';

    switch (decision.decision) {
      case 'ASK_FOLLOWUP':
        promptText = InterviewPrompts.generateFollowUpQuestion(context.config, lastResponse);
        break;
      case 'CLARIFY':
        promptText = InterviewPrompts.generateClarificationQuestion(context.config, lastResponse);
        break;
      case 'CHANGE_PHASE':
        const nextPhase = this.getNextPhase(context.state.phase);
        promptText = InterviewPrompts.generatePhaseTransition(context.config, context.state.phase, nextPhase);
        break;
      case 'WRAP_UP':
        // Provide FULL conversation history for personalized wrap-up
        const fullHistory = context.fullConversationHistory || conversationHistory;
        const fullConversationText = fullHistory
          .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
          .join('\n\n');
        promptText = InterviewPrompts.generateWrapUp(context.config, fullConversationText);
        break;
      default:
        promptText = InterviewPrompts.generateNextQuestion(context.config, context.state.phase);
    }

    return await this.llm.invoke(promptText);
  }

  // Generate practice mode feedback with sample answers
  async generatePracticeFeedback(
    config: SessionConfig,
    question: string,
    answer: string
  ): Promise<string> {
    const promptText = InterviewPrompts.generatePracticeFeedback(config, question, answer);
    return await this.llm.invoke(promptText);
  }

  // Generate final evaluation
  async generateEvaluation(
    config: SessionConfig,
    conversationHistory: Message[]
  ): Promise<string> {
    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
      .join('\n\n');

    const promptText = InterviewPrompts.generateEvaluation(config, historyText);
    return await this.llm.invoke(promptText);
  }

  // Helper method - only need this for phase transitions

  private getNextPhase(currentPhase: string): string {
    const phases = ['warmup', 'behavioral', 'technical', 'system_design', 'product', 'wrap_up'];
    const currentIndex = phases.indexOf(currentPhase);
    return phases[currentIndex + 1] || 'wrap_up';
  }

  // Get time-specific formatting instructions
  private getTimeFormatInstructions(durationMinutes: number): string {
    if (durationMinutes <= 5) {
      return `
TIME FORMAT (5 minutes - Quick Demo):
- Introduction: 30 seconds maximum
- Agenda: "We'll do 1-2 quick questions and wrap up"
- Questions: 2-3 minutes total (1-2 questions max)
- Wrap-up: 1 minute with final question
- Keep everything fast-paced and concise
      `;
    } else if (durationMinutes <= 15) {
      return `
TIME FORMAT (15 minutes - Short Interview):
- Introduction: 1 minute
- Agenda: "We'll cover behavioral questions and one technical area"
- Questions: 10-12 minutes (3-4 questions)
- Wrap-up: 2 minutes with candidate questions
- Keep responses focused and move efficiently
      `;
    } else if (durationMinutes <= 30) {
      return `
TIME FORMAT (30 minutes - Standard Interview):
- Introduction: 2-3 minutes
- Agenda: "We'll cover behavioral, technical, and have time for your questions"
- Questions: 22-25 minutes (4-6 questions)
- Wrap-up: 3-5 minutes with detailed candidate Q&A
- Allow moderate depth in responses
      `;
    } else if (durationMinutes <= 45) {
      return `
TIME FORMAT (45 minutes - Extended Interview):
- Introduction: 3-4 minutes
- Agenda: "We'll cover multiple areas including behavioral, technical, system design, and leadership"
- Questions: 35-38 minutes (6-8 questions)
- Wrap-up: 4-7 minutes with thorough candidate Q&A
- Encourage detailed responses and deep dives
      `;
    } else {
      return `
TIME FORMAT (60+ minutes - Comprehensive Interview):
- Introduction: 5 minutes with detailed agenda
- Agenda: "We'll thoroughly cover all requested interview types with deep technical discussions"
- Questions: 45-50 minutes (8-10 questions)
- Wrap-up: 5-10 minutes with comprehensive candidate Q&A about role, company, team
- Encourage very detailed responses and extensive follow-ups
      `;
    }
  }
}

export default OllamaService;
