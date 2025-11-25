import { SessionConfig } from '../types/InterviewTypes.js';

/**
 * Centralized interview prompts - single source of truth
 * All prompts consider role, seniority, company, and interview types
 */
export class InterviewPrompts {
  
  /**
   * Get context string for all prompts
   */
  private static getContext(config: SessionConfig): string {
    return `
Interview Context:
- Role: ${config.seniority} ${config.role}
- Company: ${config.company || 'the company'}
- Interview Types: ${config.interviewTypes.join(', ')}
- Duration: ${config.durationMinutes} minutes
- Mode: ${config.interviewMode}
`;
  }

  /**
   * Generate interview plan - considers role, seniority, company, interview types
   */
  static generateInterviewPlan(config: SessionConfig): string {
    return `You are an expert interview architect. Create a comprehensive, role-specific interview plan.

${this.getContext(config)}

CRITICAL: The plan must be specifically tailored to:
1. Role: ${config.role} (consider role-specific competencies)
2. Seniority Level: ${config.seniority} (adjust expectations accordingly)
3. Company: ${config.company || 'the company'} (consider company context if provided)
4. Interview Types: ${config.interviewTypes.join(', ')} (focus on these areas)
5. Duration: ${config.durationMinutes} minutes (time-appropriate depth)

Create a detailed interview plan that includes:

1. **Evaluation Categories** (3-5 categories specific to ${config.role}):
   - Each category should have a name, description, weight (0-1, sum=1), and key competencies
   - Categories MUST be role-specific (e.g., for Software Engineer: Technical Depth, System Design, Coding Skills)
   - For ${config.role}, what are the most important evaluation areas?
   - Consider ${config.interviewTypes.join(', ')} interview types in your categories

2. **Seniority Expectations** (tailored to ${config.seniority} level):
   - What depth of knowledge is expected from a ${config.seniority}?
   - What complexity of problems should a ${config.seniority} handle?
   - What leadership/mentoring is expected from a ${config.seniority}?
   - What level of independence is required for a ${config.seniority}?

3. **Interview Phases** (based on ${config.durationMinutes} minutes):
   - Break down the interview into logical phases covering ${config.interviewTypes.join(', ')}
   - Allocate time to each phase
   - List focus areas for each phase
   - Provide 2-3 sample questions per phase appropriate for ${config.seniority} ${config.role}

4. **Scoring Rubric** (5-point scale for ${config.seniority} ${config.role}):
   - Define what each score (1-5) means specifically for ${config.seniority} ${config.role}
   - Be specific about expectations at each level
   - Consider role-specific criteria and ${config.interviewTypes.join(', ')} interview types

5. **Hiring Recommendation Guidelines** (for ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}):
   - Strong Hire: What demonstrates exceptional fit for this role and level?
   - Hire: What shows good fit?
   - Maybe: What indicates potential concerns?
   - No Hire: What are deal-breakers for this specific role and seniority?

Respond ONLY with valid JSON in this exact format:
{
  "role": "${config.role}",
  "seniority": "${config.seniority}",
  "evaluationCategories": [
    {
      "name": "Category name (role-specific)",
      "description": "What this evaluates for ${config.role}",
      "weight": 0.25,
      "keyCompetencies": ["Competency 1", "Competency 2", "Competency 3"]
    }
  ],
  "seniorityExpectations": {
    "depth": "Expected knowledge depth for ${config.seniority}",
    "complexity": "Problem complexity ${config.seniority} should handle",
    "leadership": "Leadership expectations for ${config.seniority}",
    "independence": "Independence level expected from ${config.seniority}"
  },
  "interviewPhases": [
    {
      "phase": "Phase name",
      "duration": 5,
      "focusAreas": ["Area 1", "Area 2"],
      "sampleQuestions": ["Question 1 for ${config.seniority} ${config.role}", "Question 2"]
    }
  ],
  "scoringRubric": [
    {
      "score": 5,
      "description": "Exceptional for ${config.seniority} ${config.role}",
      "expectations": ["Expectation 1", "Expectation 2", "Expectation 3"]
    },
    {
      "score": 4,
      "description": "Strong for ${config.seniority} ${config.role}",
      "expectations": ["Expectation 1", "Expectation 2"]
    },
    {
      "score": 3,
      "description": "Adequate for ${config.seniority} ${config.role}",
      "expectations": ["Expectation 1", "Expectation 2"]
    },
    {
      "score": 2,
      "description": "Below expectations for ${config.seniority}",
      "expectations": ["What's missing"]
    },
    {
      "score": 1,
      "description": "Insufficient for ${config.seniority}",
      "expectations": ["Critical gaps"]
    }
  ],
  "hiringRecommendationGuidelines": {
    "strongHire": "Criteria for strong hire at ${config.seniority} level${config.company ? ` at ${config.company}` : ''}...",
    "hire": "Criteria for hire at ${config.seniority} level${config.company ? ` at ${config.company}` : ''}...",
    "maybe": "Concerns that warrant maybe at ${config.seniority} level...",
    "noHire": "Deal-breakers for ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}..."
  }
}`;
  }

  /**
   * Generate initial interview question
   */
  static generateInitialQuestion(config: SessionConfig, candidateName?: string): string {
    return `${this.getContext(config)}

You are conducting this interview for ${config.company || 'the company'}.

Your task: Create a complete opening introduction.

IMPORTANT: Do NOT ask the actual interview question yet. Just introduce yourself and ask if they're ready.

Steps:
1. Choose a professional interviewer name for yourself
2. Introduce yourself to the candidate: ${candidateName || 'there'}
3. Mention the specific role and company: ${config.seniority} ${config.role} at ${config.company || 'our company'}
4. Give brief agenda for ${config.durationMinutes} minutes covering ${config.interviewTypes.join(', ')} areas
5. Ask if they're ready to begin
6. STOP - Wait for their confirmation before asking any interview questions

Write your response as if you are speaking directly to the candidate. Use a professional, friendly tone.

CRITICAL: End your message by asking if they're ready. Do NOT proceed to ask interview questions yet.

Begin now:`;
  }

  /**
   * Generate practice mode feedback
   */
  static generatePracticeFeedback(config: SessionConfig, question: string, answer: string): string {
    return `${this.getContext(config)}

You are an interview coach providing immediate feedback in PRACTICE MODE.

Question Asked: ${question}
Candidate's Answer: ${answer}

Provide immediate coaching feedback with:
1. Score (1-5) for this specific answer based on ${config.seniority} ${config.role} standards
2. Constructive feedback on their response
3. 5 sample answers showing different approaches (varying from good to excellent for ${config.seniority} level)
4. 3 specific improvement suggestions for ${config.seniority} ${config.role}
5. Next interview question to continue practice in ${config.interviewTypes.join(' or ')} area

Format as JSON:
{
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
  "nextQuestion": "Next practice question appropriate for ${config.seniority} ${config.role} in ${config.interviewTypes.join(' or ')} area..."
}`;
  }

  /**
   * Generate final evaluation
   */
  static generateEvaluation(config: SessionConfig, conversationHistory: string): string {
    return `${this.getContext(config)}

You are a data-backed interviewer following established evaluation criteria to provide objective feedback.

Conversation History:
${conversationHistory}

DATA-BACKED EVALUATION CRITERIA FOR ${config.seniority} ${config.role}:
- Score 1: No relevant answer, off-topic, or no response
- Score 2: Minimal answer, lacks substance or examples
- Score 3: Basic answer with some relevant points but missing key details
- Score 4: Good answer with specific examples and clear explanations
- Score 5: Excellent answer with detailed examples, metrics, and comprehensive insights

OBJECTIVE HIRING RECOMMENDATIONS FOR ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}:
- "Strong Hire": Only for candidates scoring 4.5+ average with excellent specific examples, metrics, and deep insights
- "Hire": Only for candidates scoring 4.0+ average with good examples and solid explanations
- "Maybe": For candidates scoring 3.0+ average with basic but relevant answers
- "No Hire": For candidates scoring below 3.0 average or giving irrelevant/no answers

CRITICAL: The "recommendation" field in your JSON response MUST be EXACTLY one of these four values:
  "Strong Hire"
  "Hire"
  "Maybe"
  "No Hire"
Do NOT add any extra text, explanations, or modifications to these values. Use them exactly as shown.

EVALUATION CHECKLIST:
For each question-answer pair, objectively assess:
1. Does the answer directly address the question asked?
2. Does the answer include specific examples or experiences?
3. Does the answer demonstrate the required competency level for ${config.seniority} ${config.role}?
4. Is the answer substantive and detailed enough for ${config.seniority} level?
5. Does the answer align with ${config.interviewTypes.join(', ')} interview expectations?

Apply scoring criteria objectively based on content quality and relevance.

Provide calm, constructive feedback focusing on learning opportunities and growth areas.
End with encouraging tone and specific learning suggestions.

Format as JSON:
{
  "communication": { "score": 0, "feedback": "..." },
  "technicalDepth": { "score": 0, "feedback": "..." },
  "problemSolving": { "score": 0, "feedback": "..." },
  "leadership": { "score": 0, "feedback": "..." },
  "overall": {
    "score": 0,
    "recommendation": "Strong Hire",
    "strengths": ["...", "...", "..."],
    "improvements": ["Consider learning more about...", "Practice articulating...", "Develop experience in..."],
    "detailedFeedback": "Thank you for completing the interview for ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}. Based on your responses... [calm, constructive feedback with specific learning suggestions]"
  }

CRITICAL REMINDER: The "recommendation" value MUST be EXACTLY one of these strings with no modifications:
- "Strong Hire" (not "Strong Hire - ..." or "Strong hire")
- "Hire" (not "Hire -..." or "hire")  
- "Maybe" (not "Maybe -..." or "maybe")
- "No Hire" (not "No Hire -..." or "No hire")
}`;
  }

  /**
   * Evaluate whiteboard solution
   */
  static evaluateWhiteboard(config: SessionConfig, question: string, explanation?: string): string {
    return `${this.getContext(config)}

You are an expert technical interviewer evaluating a candidate's whiteboard solution.

Question: ${question}
${explanation ? `Candidate's Explanation: ${explanation}` : ''}

Analyze the whiteboard image and provide detailed feedback on:

1. **Correctness** (Score 1-5 for ${config.seniority} level):
   - Is the solution correct and complete for ${config.seniority} ${config.role}?
   - Are there any logical errors or edge cases missed?
   - Does it solve the stated problem?

2. **Design Quality** (Score 1-5):
   - Is the architecture/design sound for ${config.seniority} level?
   - Are components well-organized?
   - Is it scalable and maintainable as expected from ${config.seniority}?

3. **Technical Depth** (Score 1-5):
   - Does it demonstrate appropriate technical knowledge for ${config.seniority} ${config.role}?
   - Are best practices followed?
   - Are important considerations addressed?

4. **Communication** (Score 1-5):
   - Is the diagram clear and readable?
   - Are labels and annotations helpful?
   - Can you understand the thought process?

5. **Completeness** (Score 1-5):
   - Are all necessary components included for ${config.seniority} level?
   - Is sufficient detail provided?
   - Are trade-offs and alternatives considered?

Provide your evaluation in JSON format:
{
  "correctness": { "score": 0, "feedback": "Detailed assessment..." },
  "designQuality": { "score": 0, "feedback": "Detailed assessment..." },
  "technicalDepth": { "score": 0, "feedback": "Detailed assessment..." },
  "communication": { "score": 0, "feedback": "Detailed assessment..." },
  "completeness": { "score": 0, "feedback": "Detailed assessment..." },
  "overall": {
    "score": 0,
    "strengths": ["Strength 1", "Strength 2", "Strength 3"],
    "improvements": ["Improvement 1", "Improvement 2", "Improvement 3"],
    "recommendation": "Strong Hire/Hire/Maybe/No Hire",
    "detailedFeedback": "Comprehensive feedback on the whiteboard solution for ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}..."
  },
  "followUpQuestions": [
    "Follow-up question 1 to probe deeper",
    "Follow-up question 2 about specific aspects",
    "Follow-up question 3 about trade-offs"
  ]
}

Be constructive and specific in your feedback. For a ${config.seniority} ${config.role}${config.company ? ` at ${config.company}` : ''}, adjust expectations accordingly.`;
  }

  /**
   * Generate follow-up question
   */
  static generateFollowUpQuestion(config: SessionConfig, lastResponse: string): string {
    return `${this.getContext(config)}

You are continuing the interview (do NOT re-introduce yourself). The candidate just said: "${lastResponse}"

This response needs more depth. Ask a thoughtful follow-up question to get more details about:
- Specific actions they took
- Challenges they faced
- Results/impact they achieved
- What they learned

Keep it conversational and encouraging. Ask only ONE follow-up question.
Do NOT mention any time estimates or durations.`;
  }

  /**
   * Generate clarification question
   */
  static generateClarificationQuestion(config: SessionConfig, lastResponse: string): string {
    return `${this.getContext(config)}

Continue the interview (do NOT re-introduce yourself). The candidate's last response was unclear: "${lastResponse}"

Politely ask for clarification. Be encouraging and help them reframe their answer.
Show that you're genuinely interested in understanding their experience better.

Ask only ONE clarifying question.
Do NOT mention any time estimates or durations.`;
  }

  /**
   * Generate phase transition
   */
  static generatePhaseTransition(config: SessionConfig, currentPhase: string, nextPhase: string): string {
    return `${this.getContext(config)}

Continue the interview (do NOT re-introduce yourself). Transition from ${currentPhase} questions to ${nextPhase} questions.

Provide a brief transition statement and ask the first ${nextPhase} question appropriate for ${config.seniority} ${config.role}.
Keep the transition smooth and professional.

Ask only ONE question.
Do NOT mention any time estimates or durations.`;
  }

  /**
   * Generate wrap-up message with full conversation context
   */
  static generateWrapUp(config: SessionConfig, fullConversation: string): string {
    return `${this.getContext(config)}

Continue the interview (do NOT re-introduce yourself). Provide a professional wrap-up for the ${config.seniority} ${config.role} position at ${config.company || 'our company'}.

CRITICAL: Review the FULL conversation history below and use SPECIFIC details from what was actually discussed!

FULL CONVERSATION HISTORY:
${fullConversation}

Based on the above conversation, provide a personalized wrap-up that:
1. Thanks them by name (if provided) for their time
2. Mentions 2-3 SPECIFIC things they discussed (actual projects, skills, experiences they mentioned)
3. References the actual role: ${config.seniority} ${config.role}
4. References the actual company: ${config.company || 'our company'}
5. Highlights something impressive from their responses
6. Explains next steps (detailed feedback will be provided)
7. Asks if they have questions about the role or ${config.company || 'the company'}

Example format:
"Thank you so much, [Name], for taking the time today. I was particularly impressed by [specific thing they mentioned in detail], especially how you [specific approach/result they described]. Your experience with [specific technology/skill they discussed] really demonstrates the [quality] we're looking for in our ${config.seniority} ${config.role} team at ${config.company || 'our company'}. I'll be compiling detailed feedback for the hiring team. Before we finish, do you have any questions about the role or ${config.company || 'our company'}?"

Write naturally using their ACTUAL discussion points. Do NOT use generic placeholders.
Do NOT mention any time estimates or durations.`;
  }

  /**
   * Analyze content for appropriateness using LLM with conversation history
   */
  static analyzeContentModeration(response: string, question: string, previousWarnings: number, recentHistory?: string): string {
    return `You are a content moderation system. Analyze if the following response contains inappropriate content.

${recentHistory ? `Recent Conversation:\n${recentHistory}\n` : ''}

Question Asked: ${question}

Candidate's Response: "${response}"

Previous Warnings Issued: ${previousWarnings}

Analyze for:
1. **Profanity**: Swear words, vulgar language, explicit content  
2. **Abusive Language**: Insults (stupid, idiot, fool, dumb), harassment, threats, hate speech, disrespectful behavior
3. **Off-Topic**: Completely unrelated or nonsensical responses

Be contextually aware:
- Technical terms (e.g., "git", "assembly", "kill process") are acceptable
- Industry jargon is fine
- Only flag genuinely inappropriate, disrespectful, or abusive content

IMPORTANT: If previous warnings = 1, be more strict - this is the final chance.

CRITICAL: Respond with ONLY valid JSON, no extra text before or after.

{
  "isAppropriate": true,
  "containsProfanity": false,
  "isAbusive": false,
  "isOnTopic": true,
  "severity": "low",
  "reason": "Brief explanation",
  "flaggedWords": [],
  "recommendation": "continue"
}`;
  }

  /**
   * Generate next question
   */
  static generateNextQuestion(config: SessionConfig, phase: string): string {
    return `${this.getContext(config)}

Continue the interview (do NOT re-introduce yourself). Ask the next appropriate ${phase} question for ${config.seniority} ${config.role}.
Make it challenging but fair for a ${config.seniority} candidate.

Ask only ONE question.
Do NOT mention any time estimates or durations.`;
  }

  /**
   * Make agentic decision with time awareness
   */
  static makeAgenticDecision(
    config: SessionConfig, 
    phase: string, 
    questionsAsked: number, 
    lastResponse: string,
    elapsedMinutes?: number
  ): string {
    const timeRemaining = elapsedMinutes !== undefined ? config.durationMinutes - elapsedMinutes : config.durationMinutes;
    const percentComplete = elapsedMinutes !== undefined ? Math.round((elapsedMinutes / config.durationMinutes) * 100) : 0;
    
    return `${this.getContext(config)}

You are an intelligent interview agent conducting a ${config.interviewTypes.join(', ')} interview.

CRITICAL TIME TRACKING:
- Total Duration: ${config.durationMinutes} minutes
- Elapsed Time: ${elapsedMinutes?.toFixed(1) || 0} minutes
- Remaining Time: ${timeRemaining.toFixed(1)} minutes
- Progress: ${percentComplete}% complete
- Questions Asked So Far: ${questionsAsked}

Current State:
- Interview Phase: ${phase}
- Recent Candidate Response: ${lastResponse}

Your options:
1. ASK_FOLLOWUP - Ask a follow-up question to dig deeper
2. MOVE_NEXT - Move to the next question/topic
3. CHANGE_PHASE - Switch to a different interview phase
4. CLARIFY - Ask for clarification due to unclear response
5. WRAP_UP - Begin concluding the interview
6. REDIRECT - Response was off-topic or inappropriate, redirect to question
7. MODERATE - Response contained inappropriate content, issue warning

Decision Criteria for ${config.seniority} ${config.role}:
- **TIME CRITICAL**: If less than 20% time remaining (${(config.durationMinutes * 0.2).toFixed(1)} min), you MUST choose WRAP_UP
- **TIME WARNING**: If less than 30% time remaining (${(config.durationMinutes * 0.3).toFixed(1)} min), avoid follow-ups, move to wrap up phase
- **PACING**: Consider questions asked vs time remaining - aim for ${Math.ceil(config.durationMinutes / 5)} questions total
- If response is vague or incomplete AND sufficient time remains, consider ASK_FOLLOWUP or CLARIFY
- If response is comprehensive, consider MOVE_NEXT
- If response is completely off-topic or random, use REDIRECT
- If response contains inappropriate language, use MODERATE
- If you've asked enough questions in current phase AND time permits, consider CHANGE_PHASE
- If ${percentComplete}% complete or ${questionsAsked} >= ${Math.ceil(config.durationMinutes / 5)}, strongly consider WRAP_UP
- For junior candidates, be more encouraging and allow shorter responses
- For senior candidates, expect more depth and strategic thinking

REMEMBER: You have ${timeRemaining.toFixed(1)} minutes left. Plan accordingly!

Respond in JSON format:
{
  "decision": "ACTION_TYPE",
  "reasoning": "Brief explanation considering time remaining (${timeRemaining.toFixed(1)} min)",
  "context": "What you observed that led to this decision"
}`;
  }
}

export default InterviewPrompts;
