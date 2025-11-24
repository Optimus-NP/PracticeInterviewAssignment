import { Ollama } from '@langchain/community/llms/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { AgenticPromptContext, SessionConfig, SessionState, Message, AgenticDecision } from '../types/InterviewTypes.js';
import axios from 'axios';

export class OllamaService {
  private llm: Ollama;
  private baseUrl: string;
  private model: string;
  private interviewerNames: string[] = [
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
    'Sam', 'Blake', 'Cameron', 'Sage', 'River', 'Drew', 'Hayden', 'Rowan'
  ];

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

  // Get a random interviewer name
  private getRandomInterviewerName(): string {
    return this.interviewerNames[Math.floor(Math.random() * this.interviewerNames.length)];
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

  // Generate initial interview question based on config
  async generateInitialQuestion(config: SessionConfig): Promise<string> {
    const timeFormat = this.getTimeFormatInstructions(config.durationMinutes);
    const interviewerName = this.getRandomInterviewerName();
    
    const prompt = PromptTemplate.fromTemplate(`
You are an AI interview partner conducting a mock interview. Your name is {interviewerName} and you act like a professional human interviewer.

Interview Configuration:
- Role: {role}
- Seniority Level: {seniority}
- Interview Types: {interviewTypes}
- Company: {company}
- Duration: {duration} minutes

{timeFormat}

Instructions:
1. Start with a brief, professional introduction using your name {interviewerName}
2. Present a clear agenda for the interview time
3. Ask if the candidate is ready to begin
4. Ask the first relevant question based on the role and seniority
5. Show enthusiasm and professionalism

Begin the interview now with introduction and agenda:
    `);

    const formattedPrompt = await prompt.format({
      interviewerName: interviewerName,
      role: config.role,
      seniority: config.seniority,
      interviewTypes: config.interviewTypes.join(', '),
      company: config.company || 'this company',
      duration: config.durationMinutes,
      timeFormat: timeFormat
    });

    return await this.llm.invoke(formattedPrompt);
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
      response.includes('jklsdf') || response.includes('asdf') || response.includes('qwerty');
    
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
    const prompt = PromptTemplate.fromTemplate(`
You are an intelligent interview agent. Analyze the current interview context and make a decision about what to do next.

Current Context:
- Role: {role}
- Seniority: {seniority}
- Interview Phase: {phase}
- Questions Asked: {questionsAsked}
- Recent Candidate Response: {lastResponse}

Your options:
1. ASK_FOLLOWUP - Ask a follow-up question to dig deeper
2. MOVE_NEXT - Move to the next question/topic
3. CHANGE_PHASE - Switch to a different interview phase
4. CLARIFY - Ask for clarification due to unclear response
5. WRAP_UP - Begin concluding the interview
6. REDIRECT - Response was off-topic or inappropriate, redirect to question
7. MODERATE - Response contained inappropriate content, issue warning

Decision Criteria:
- If response is vague or incomplete, consider ASK_FOLLOWUP or CLARIFY
- If response is comprehensive and time permits, consider MOVE_NEXT
- If response is completely off-topic or random, use REDIRECT
- If response contains inappropriate language, use MODERATE
- If you've asked enough questions in current phase, consider CHANGE_PHASE
- If approaching time limit or asked enough questions, consider WRAP_UP
- For junior candidates, be more encouraging and allow shorter responses
- For senior candidates, expect more depth and strategic thinking

Respond in JSON format:
{{
  "decision": "ACTION_TYPE",
  "reasoning": "Brief explanation of why you chose this action",
  "context": "What you observed that led to this decision"
}}
    `);

    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    const formattedPrompt = await prompt.format({
      role: context.config.role,
      seniority: context.config.seniority,
      phase: context.state.phase,
      questionsAsked: context.state.questionsAsked,
      lastResponse: lastMessage?.content || 'No recent response'
    });

    const response = await this.llm.invoke(formattedPrompt);
    
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

    switch (decision.decision) {
      case 'ASK_FOLLOWUP':
        prompt = this.getFollowUpPrompt(context, conversationHistory);
        break;
      case 'CLARIFY':
        prompt = this.getClarificationPrompt(context, conversationHistory);
        break;
      case 'CHANGE_PHASE':
        prompt = this.getPhaseChangePrompt(context);
        break;
      case 'WRAP_UP':
        prompt = this.getWrapUpPrompt(context);
        break;
      default:
        prompt = this.getNextQuestionPrompt(context);
    }

    return await this.llm.invoke(prompt);
  }

  // Generate practice mode feedback with sample answers
  async generatePracticeFeedback(
    config: SessionConfig,
    question: string,
    answer: string
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
You are an interview coach providing immediate feedback in PRACTICE MODE.

Interview Context:
- Role: {role}  
- Seniority: {seniority}
- Question Asked: {question}
- Candidate's Answer: {answer}

Provide immediate coaching feedback with:
1. Score (1-5) for this specific answer
2. Constructive feedback on their response
3. 5 sample answers showing different approaches (varying from good to excellent)
4. 3 specific improvement suggestions
5. Next interview question to continue practice

Format as JSON:
{{
  "score": 0,
  "feedback": "Brief assessment of their answer quality, structure, and content...",
  "sampleAnswers": [
    "Sample answer 1 (basic but acceptable approach)...",
    "Sample answer 2 (includes specific examples)...", 
    "Sample answer 3 (demonstrates impact/metrics)...",
    "Sample answer 4 (shows leadership/initiative)...",
    "Sample answer 5 (comprehensive with STAR method)..."
  ],
  "improvements": [
    "Specific improvement suggestion 1...",
    "Specific improvement suggestion 2...", 
    "Specific improvement suggestion 3..."
  ],
  "nextQuestion": "Next practice question appropriate for {seniority} {role}..."
}}
    `);

    const formattedPrompt = await prompt.format({
      role: config.role,
      seniority: config.seniority,
      question: question,
      answer: answer
    });

    return await this.llm.invoke(formattedPrompt);
  }

  // Generate final evaluation
  async generateEvaluation(
    config: SessionConfig,
    conversationHistory: Message[]
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
You are a data-backed interviewer following established evaluation criteria to provide objective feedback.

Interview Details:
- Role: {role}
- Seniority: {seniority}
- Interview Types: {interviewTypes}

Conversation History:
{conversationHistory}

DATA-BACKED EVALUATION CRITERIA:
- Score 1: No relevant answer, off-topic, or no response
- Score 2: Minimal answer, lacks substance or examples  
- Score 3: Basic answer with some relevant points but missing key details
- Score 4: Good answer with specific examples and clear explanations
- Score 5: Excellent answer with detailed examples, metrics, and comprehensive insights

OBJECTIVE HIRING RECOMMENDATIONS:
- "Strong Hire": Only for candidates scoring 4.5+ average with excellent specific examples, metrics, and deep insights
- "Hire": Only for candidates scoring 4.0+ average with good examples and solid explanations  
- "Maybe": For candidates scoring 3.0+ average with basic but relevant answers
- "No Hire": For candidates scoring below 3.0 average or giving irrelevant/no answers

EVALUATION CHECKLIST:
For each question-answer pair, objectively assess:
1. Does the answer directly address the question asked?
2. Does the answer include specific examples or experiences?
3. Does the answer demonstrate the required competency level for {seniority}?
4. Is the answer substantive and detailed enough?

Apply scoring criteria objectively based on content quality and relevance.

Provide calm, constructive feedback focusing on learning opportunities and growth areas.
End with encouraging tone and specific learning suggestions.

Format as JSON:
{{
  "communication": {{ "score": 0, "feedback": "..." }},
  "technicalDepth": {{ "score": 0, "feedback": "..." }},
  "problemSolving": {{ "score": 0, "feedback": "..." }},
  "leadership": {{ "score": 0, "feedback": "..." }},
  "overall": {{
    "score": 0,
    "recommendation": "...",
    "strengths": ["...", "...", "..."],
    "improvements": ["Consider learning more about...", "Practice articulating...", "Develop experience in..."],
    "detailedFeedback": "Thank you for completing the interview. Based on your responses... [calm, constructive feedback with specific learning suggestions]"
  }}
}}
    `);

    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
      .join('\n\n');

    const formattedPrompt = await prompt.format({
      role: config.role,
      seniority: config.seniority,
      interviewTypes: config.interviewTypes.join(', '),
      conversationHistory: historyText
    });

    return await this.llm.invoke(formattedPrompt);
  }

  // Helper methods for different prompt types
  private getFollowUpPrompt(context: AgenticPromptContext, history: Message[]): string {
    const lastResponse = history[history.length - 1]?.content || '';
    return `
You are continuing the interview (do NOT re-introduce yourself). The candidate just said: "${lastResponse}"

This response needs more depth. Ask a thoughtful follow-up question to get more details about:
- Specific actions they took
- Challenges they faced
- Results/impact they achieved  
- What they learned

Keep it conversational and encouraging. Ask only ONE follow-up question.
Do NOT mention any time estimates or durations.
    `;
  }

  private getClarificationPrompt(context: AgenticPromptContext, history: Message[]): string {
    const lastResponse = history[history.length - 1]?.content || '';
    return `
Continue the interview (do NOT re-introduce yourself). The candidate's last response was unclear: "${lastResponse}"

Politely ask for clarification. Be encouraging and help them reframe their answer. 
Show that you're genuinely interested in understanding their experience better.

Ask only ONE clarifying question.
Do NOT mention any time estimates or durations.
    `;
  }

  private getPhaseChangePrompt(context: AgenticPromptContext): string {
    const nextPhase = this.getNextPhase(context.state.phase);
    return `
Continue the interview (do NOT re-introduce yourself). Transition from ${context.state.phase} questions to ${nextPhase} questions.

Provide a brief transition statement and ask the first ${nextPhase} question appropriate for their level.
Keep the transition smooth and professional.

Ask only ONE question.
Do NOT mention any time estimates or durations.
    `;
  }

  private getWrapUpPrompt(context: AgenticPromptContext): string {
    return `
Continue the interview (do NOT re-introduce yourself). Provide a professional wrap-up:
1. Thank them for their time
2. Give brief encouraging feedback
3. Explain next steps (you'll provide detailed feedback shortly)
4. Ask if they have any questions about the role or company

Keep it warm, professional, and encouraging.
Do NOT mention any time estimates or durations.
    `;
  }

  private getNextQuestionPrompt(context: AgenticPromptContext): string {
    return `
Continue the interview (do NOT re-introduce yourself). Ask the next appropriate ${context.state.phase} question for their seniority level.
Make it challenging but fair for a ${context.config.seniority} candidate.

Ask only ONE question.
Do NOT mention any time estimates or durations.
    `;
  }

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
