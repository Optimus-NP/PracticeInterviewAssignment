import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { AgenticPromptContext, SessionConfig, SessionState, Message, AgenticDecision, InterviewPlan } from '../types/InterviewTypes.js';
import { ILLMService } from './LLMService.js';
import InterviewPrompts from '../prompts/InterviewPrompts.js';

export class BedrockService implements ILLMService {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-west-2';
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // Initialize Bedrock client - credentials loaded from environment or AWS config
    this.client = new BedrockRuntimeClient({
      region: this.region,
    });
  }

  // Test connection to Bedrock
  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Hello, please respond with "OK" if you receive this message.';
      const response = await this.invokeModel(testPrompt);
      return response.length > 0;
    } catch (error) {
      console.error('Bedrock connection failed:', error);
      return false;
    }
  }

  // Generate comprehensive interview plan tailored to role and seniority
  async generateInterviewPlan(config: SessionConfig): Promise<InterviewPlan> {
    const prompt = InterviewPrompts.generateInterviewPlan(config);
    const response = await this.invokeModel(prompt, 4096);
    
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

  // Core method to invoke Bedrock model
  private async invokeModel(prompt: string, maxTokens: number = 2048): Promise<string> {
    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        top_p: 0.9,
      };

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      };

      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Extract text from Claude's response format
      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content[0].text;
      }

      return '';
    } catch (error) {
      console.error('Error invoking Bedrock model:', error);
      throw error;
    }
  }

  // Generate initial interview question based on config
  async generateInitialQuestion(config: SessionConfig, candidateName?: string): Promise<string> {
    const prompt = InterviewPrompts.generateInitialQuestion(config, candidateName);
    return await this.invokeModel(prompt);
  }

  // Check for inappropriate content or off-topic responses
  async analyzeResponseApproppriateness(response: string, question: string): Promise<{
    isAppropriate: boolean;
    isOnTopic: boolean;
    containsProfanity: boolean;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }> {
    // Only flag truly problematic content to avoid false positives
    const profanityPatterns = [
      /\bf\*?u\*?c\*?k/i, /\bs\*?h\*?i\*?t/i, /\bb\*?i\*?t\*?c\*?h/i,
      /\ba\*?s\*?s\*?h\*?o\*?l\*?e/i, /\bd\*?a\*?m\*?n/i
    ];

    const hasProfanity = profanityPatterns.some(pattern => pattern.test(response));

    // Check for completely random responses (very short nonsense)
    const isVeryShortNonsense = response.trim().length < 10 &&
      !/[a-zA-Z]{3,}/.test(response) &&
      (response.includes('jklsdf') || response.includes('asdf') || response.includes('qwerty'));

    // Be more lenient - only flag severe issues
    if (hasProfanity) {
      return {
        isAppropriate: false,
        isOnTopic: true,
        containsProfanity: true,
        severity: 'high',
        reason: 'Contains inappropriate language'
      };
    }

    if (isVeryShortNonsense) {
      return {
        isAppropriate: true,
        isOnTopic: false,
        containsProfanity: false,
        severity: 'low',
        reason: 'Response appears to be random characters'
      };
    }

    // Default to appropriate for normal responses
    return {
      isAppropriate: true,
      isOnTopic: true,
      containsProfanity: false,
      severity: 'low',
      reason: 'Response appears appropriate'
    };
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
    
    const prompt = InterviewPrompts.makeAgenticDecision(
      context.config,
      context.state.phase,
      context.state.questionsAsked,
      lastMessage?.content || 'No recent response',
      elapsedMinutes
    );

    const response = await this.invokeModel(prompt, 1024);

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
    let prompt: string;
    const lastResponse = conversationHistory[conversationHistory.length - 1]?.content || '';

    switch (decision.decision) {
      case 'ASK_FOLLOWUP':
        prompt = InterviewPrompts.generateFollowUpQuestion(context.config, lastResponse);
        break;
      case 'CLARIFY':
        prompt = InterviewPrompts.generateClarificationQuestion(context.config, lastResponse);
        break;
      case 'CHANGE_PHASE':
        const nextPhase = this.getNextPhase(context.state.phase);
        prompt = InterviewPrompts.generatePhaseTransition(context.config, context.state.phase, nextPhase);
        break;
      case 'WRAP_UP':
        // Provide FULL conversation history for personalized wrap-up
        const fullHistory = context.fullConversationHistory || conversationHistory;
        const fullConversationText = fullHistory
          .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
          .join('\n\n');
        prompt = InterviewPrompts.generateWrapUp(context.config, fullConversationText);
        break;
      default:
        prompt = InterviewPrompts.generateNextQuestion(context.config, context.state.phase);
    }

    return await this.invokeModel(prompt);
  }

  // Generate practice mode feedback with sample answers
  async generatePracticeFeedback(
    config: SessionConfig,
    question: string,
    answer: string
  ): Promise<string> {
    const prompt = InterviewPrompts.generatePracticeFeedback(config, question, answer);
    return await this.invokeModel(prompt, 3072);
  }

  // Generate final evaluation
  async generateEvaluation(
    config: SessionConfig,
    conversationHistory: Message[]
  ): Promise<string> {
    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
      .join('\n\n');

    const prompt = InterviewPrompts.generateEvaluation(config, historyText);
    return await this.invokeModel(prompt, 4096);
  }

  // Helper method - only need this for phase transitions

  private getNextPhase(currentPhase: string): string {
    const phases = ['warmup', 'behavioral', 'technical', 'system_design', 'product', 'wrap_up'];
    const currentIndex = phases.indexOf(currentPhase);
    return phases[currentIndex + 1] || 'wrap_up';
  }

  // Evaluate whiteboard drawing with vision capabilities
  async evaluateWhiteboard(
    config: SessionConfig,
    question: string,
    imageBase64: string,
    explanation?: string
  ): Promise<string> {
    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: InterviewPrompts.evaluateWhiteboard(config, question, explanation),
              },
            ],
          },
        ],
        temperature: 0.7,
        top_p: 0.9,
      };

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      };

      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content[0].text;
      }

      return JSON.stringify({
        error: 'No evaluation generated',
        message: 'The model did not return a proper evaluation.',
      });
    } catch (error) {
      console.error('Error evaluating whiteboard:', error);
      throw error;
    }
  }
}

export default BedrockService;
