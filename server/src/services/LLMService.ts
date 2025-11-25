import { BedrockService } from './BedrockService.js';
import { OllamaService } from './OllamaService.js';
import { AgenticPromptContext, SessionConfig, Message, AgenticDecision, InterviewPlan } from '../types/InterviewTypes.js';

// Unified interface for all LLM services
export interface ILLMService {
  testConnection(): Promise<boolean>;
  generateInterviewPlan(config: SessionConfig): Promise<InterviewPlan>;
  generateInitialQuestion(config: SessionConfig, candidateName?: string): Promise<string>;
  analyzeResponseApproppriateness(
    response: string, 
    question: string,
    previousWarnings?: number,
    recentHistory?: string
  ): Promise<{
    isAppropriate: boolean;
    isOnTopic: boolean;
    containsProfanity: boolean;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  generateModerationResponse(
    analysis: any,
    warningCount: number,
    question: string
  ): Promise<{ message: string; shouldTerminate: boolean }>;
  makeAgenticDecision(context: AgenticPromptContext): Promise<AgenticDecision>;
  generateNextQuestion(
    decision: AgenticDecision,
    context: AgenticPromptContext,
    conversationHistory: Message[]
  ): Promise<string>;
  generatePracticeFeedback(
    config: SessionConfig,
    question: string,
    answer: string
  ): Promise<string>;
  generateEvaluation(
    config: SessionConfig,
    conversationHistory: Message[]
  ): Promise<string>;
  evaluateWhiteboard?(
    config: SessionConfig,
    question: string,
    imageBase64: string,
    explanation?: string
  ): Promise<string>;
}

// Unified LLM service with automatic fallback
export class LLMService implements ILLMService {
  private primaryService: ILLMService | null = null;
  private fallbackService: ILLMService | null = null;
  private activeService: ILLMService | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeServices();
  }

  private async initializeServices() {
    const useBedrock = process.env.USE_BEDROCK === 'true';

    try {
      if (useBedrock) {
        console.log('🚀 Initializing AWS Bedrock as primary LLM service...');
        this.primaryService = new BedrockService();
        const connected = await this.primaryService.testConnection();
        
        if (connected) {
          console.log('✅ AWS Bedrock connected successfully');
          this.activeService = this.primaryService;
          return; // Success! Use Bedrock
        } else {
          console.log('⚠️  AWS Bedrock connection failed, will try Ollama...');
        }
      }
    } catch (error) {
      console.error('❌ Error initializing Bedrock:', error);
    }

    // Initialize fallback (Ollama)
    if (!this.activeService) {
      try {
        console.log('🔄 Initializing Ollama as LLM service...');
        this.fallbackService = new OllamaService();
        const connected = await this.fallbackService.testConnection();
        
        if (connected) {
          console.log('✅ Ollama connected successfully');
          this.activeService = this.fallbackService;
        } else {
          console.error('❌ No LLM service available!');
        }
      } catch (error) {
        console.error('❌ Error initializing Ollama:', error);
      }
    }
  }

  private async getService(): Promise<ILLMService> {
    await this.initPromise; // Wait for initialization to complete
    if (!this.activeService) {
      throw new Error('No LLM service is available. Please check your configuration.');
    }
    return this.activeService;
  }

  async testConnection(): Promise<boolean> {
    try {
      const service = await this.getService();
      return await service.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async generateInterviewPlan(config: SessionConfig): Promise<InterviewPlan> {
    const service = await this.getService();
    return await service.generateInterviewPlan(config);
  }

  async generateInitialQuestion(config: SessionConfig, candidateName?: string): Promise<string> {
    const service = await this.getService();
    return await service.generateInitialQuestion(config, candidateName);
  }

  async analyzeResponseApproppriateness(
    response: string, 
    question: string,
    previousWarnings?: number,
    recentHistory?: string
  ) {
    const service = await this.getService();
    return await service.analyzeResponseApproppriateness(response, question, previousWarnings, recentHistory);
  }

  async generateModerationResponse(analysis: any, warningCount: number, question: string) {
    const service = await this.getService();
    return await service.generateModerationResponse(analysis, warningCount, question);
  }

  async makeAgenticDecision(context: AgenticPromptContext): Promise<AgenticDecision> {
    const service = await this.getService();
    return await service.makeAgenticDecision(context);
  }

  async generateNextQuestion(
    decision: AgenticDecision,
    context: AgenticPromptContext,
    conversationHistory: Message[]
  ): Promise<string> {
    const service = await this.getService();
    return await service.generateNextQuestion(decision, context, conversationHistory);
  }

  async generatePracticeFeedback(
    config: SessionConfig,
    question: string,
    answer: string
  ): Promise<string> {
    const service = await this.getService();
    return await service.generatePracticeFeedback(config, question, answer);
  }

  async generateEvaluation(
    config: SessionConfig,
    conversationHistory: Message[]
  ): Promise<string> {
    const service = await this.getService();
    return await service.generateEvaluation(config, conversationHistory);
  }

  async evaluateWhiteboard(
    config: SessionConfig,
    question: string,
    imageBase64: string,
    explanation?: string
  ): Promise<string> {
    const service = await this.getService();
    
    if (service.evaluateWhiteboard) {
      return await service.evaluateWhiteboard(config, question, imageBase64, explanation);
    }
    
    throw new Error('Whiteboard evaluation not supported by current LLM service');
  }

  async getActiveServiceName(): Promise<string> {
    await this.initPromise; // Wait for initialization
    if (this.activeService === this.primaryService) {
      return 'AWS Bedrock';
    } else if (this.activeService === this.fallbackService) {
      return 'Ollama';
    }
    return 'None';
  }
}

export default LLMService;
