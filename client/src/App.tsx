import React, { useState } from 'react';
import './App.css';
import VoiceControls from './components/VoiceControls';
import SpeechService from './services/speechService';
import HelpModal from './components/HelpModal';

interface InterviewConfig {
  candidateName?: string;
  candidateEmail?: string;
  role: string;
  seniority: string;
  interviewTypes: string[];
  company?: string;
  durationMinutes: number;
  questionFamiliarity: string;
  interviewMode: 'practice' | 'mock'; // NEW: Practice vs Mock Interview mode
}

// Role configuration interface
interface RoleConfig {
  [role: string]: {
    seniorities: string[];
    interviewTypes: string[];
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SessionState {
  phase: string;
  questionsAsked: number;
  isActive: boolean;
}

function App() {
  const [currentStep, setCurrentStep] = useState<'setup' | 'interview' | 'evaluation'>('setup');
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [roleConfig, setRoleConfig] = useState<RoleConfig>({});
  
  // Voice mode states
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechService] = useState(() => new SpeechService());
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const [config, setConfig] = useState<InterviewConfig>({
    candidateName: '',
    candidateEmail: '',
    role: 'Software Engineer',
    seniority: 'Intern',
    interviewTypes: ['Behavioral'],
    company: '',
    durationMinutes: 30,
    questionFamiliarity: 'mixed',
    interviewMode: 'practice' // Default to practice mode
  });

  // Session persistence and API calls
  React.useEffect(() => {
    checkApiHealth();
    loadRoleConfig();
    loadSavedSession();
  }, []);

  // Save session to localStorage
  React.useEffect(() => {
    if (sessionId) {
      const sessionData = {
        sessionId,
        currentStep,
        messages,
        sessionState,
        evaluation,
        config,
        timestamp: Date.now()
      };
      localStorage.setItem('interviewSession', JSON.stringify(sessionData));
    }
  }, [sessionId, currentStep, messages, sessionState, evaluation, config]);

  const loadSavedSession = () => {
    const saved = localStorage.getItem('interviewSession');
    if (saved) {
      try {
        const sessionData = JSON.parse(saved);
        // Only restore if session is less than 2 hours old
        if (Date.now() - sessionData.timestamp < 2 * 60 * 60 * 1000) {
          setSessionId(sessionData.sessionId);
          setCurrentStep(sessionData.currentStep);
          setMessages(sessionData.messages || []);
          setSessionState(sessionData.sessionState);
          setEvaluation(sessionData.evaluation);
          setConfig(sessionData.config);
        } else {
          localStorage.removeItem('interviewSession');
        }
      } catch (error) {
        console.error('Error loading saved session:', error);
        localStorage.removeItem('interviewSession');
      }
    }
  };

  // Load role configuration from API
  const loadRoleConfig = async () => {
    try {
      const response = await fetch('/api/role-config');
      if (response.ok) {
        const data = await response.json();
        setRoleConfig(data);
        
        // Update initial config with first available options for Software Engineer
        const swEngConfig = data['Software Engineer'];
        if (swEngConfig) {
          setConfig(prev => ({
            ...prev,
            seniority: swEngConfig.seniorities[0],
            interviewTypes: [swEngConfig.interviewTypes[0]]
          }));
        }
      }
    } catch (error) {
      console.error('Error loading role config:', error);
    }
  };

  // Handle role change - update seniority and interview types
  const handleRoleChange = (newRole: string) => {
    const selectedRoleConfig = roleConfig[newRole];
    if (selectedRoleConfig) {
      setConfig(prev => ({
        ...prev,
        role: newRole,
        seniority: selectedRoleConfig.seniorities[0], // Set to first available seniority
        interviewTypes: [selectedRoleConfig.interviewTypes[0]] // Set to first available interview type
      }));
    }
  };

  // Get available options based on selected role
  const getAvailableSeniorities = () => {
    const selectedRoleConfig = roleConfig[config.role];
    return selectedRoleConfig ? selectedRoleConfig.seniorities : ['Entry Level', 'Mid Level', 'Senior Level'];
  };

  const getAvailableInterviewTypes = () => {
    const selectedRoleConfig = roleConfig[config.role];
    return selectedRoleConfig ? selectedRoleConfig.interviewTypes : ['Behavioral', 'Technical', 'Case Study'];
  };

  const checkApiHealth = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        const data = await response.json();
        setApiStatus(data.connected ? 'connected' : 'disconnected');
      } else {
        setApiStatus('disconnected');
      }
    } catch (error) {
      setApiStatus('disconnected');
    }
  };

  const startInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([{
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }]);
      setSessionState(data.state);
      setCurrentStep('interview');
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Please check if the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // Voice handlers
  const handleVoiceTranscript = (transcript: string) => {
    setCurrentMessage(transcript);
    setIsListening(false);
  };

  const handleVoiceModeChange = (enabled: boolean) => {
    setIsVoiceEnabled(enabled);
    if (!enabled) {
      speechService.stop();
    }
  };

  const speakAIResponse = async (text: string) => {
    if (isVoiceEnabled && speechService.isSupported()) {
      try {
        await speechService.speak(text);
      } catch (error) {
        console.error('Error speaking AI response:', error);
      }
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !sessionId) return;
    
    console.log('[DEBUG] Starting sendMessage...');

    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = currentMessage; // Save before clearing
    setCurrentMessage('');
    setIsLoading(true);
    console.log('[DEBUG] isLoading set to TRUE');

    // Aggressive timeout to prevent stuck loading state
    const safetyTimeout = setTimeout(() => {
      console.error('[DEBUG] SAFETY TIMEOUT - Force resetting loading state');
      setIsLoading(false);
      alert('Request took too long. Input has been re-enabled.');
    }, 30000); // 30 second safety timeout

    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => {
        console.log('[DEBUG] Aborting fetch due to timeout');
        controller.abort();
      }, 25000); // 25 second fetch timeout

      console.log('[DEBUG] Sending request to server...');
      const response = await fetch('/api/sessions/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: messageToSend
        }),
        signal: controller.signal
      });

      clearTimeout(fetchTimeout);
      console.log('[DEBUG] Response received, status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[DEBUG] Data parsed successfully');
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setSessionState(data.state);
      console.log('[DEBUG] Messages and state updated');

      // Check if interview completed
      if (data.evaluation) {
        console.log('[DEBUG] Evaluation received, switching to evaluation screen');
        setEvaluation(data.evaluation);
        setCurrentStep('evaluation');
      }

      // Speak AI response if voice mode is enabled (non-blocking)
      speakAIResponse(data.message).catch(err => {
        console.error('[DEBUG] Error speaking response (non-blocking):', err);
      });

    } catch (error: any) {
      console.error('[DEBUG] Error in sendMessage:', error);
      if (error.name === 'AbortError') {
        alert('Request timed out. The AI is taking too long to respond. Please try again.');
      } else {
        alert('Failed to send message. Please check the console and try again.');
      }
      // Restore message so user doesn't lose their input
      setCurrentMessage(messageToSend);
    } finally {
      clearTimeout(safetyTimeout);
      console.log('[DEBUG] Finally block - setting isLoading to FALSE');
      setIsLoading(false);
      
      // Force a small delay to ensure state updates
      setTimeout(() => {
        console.log('[DEBUG] Double-check - isLoading should be false now');
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetInterview = () => {
    localStorage.removeItem('interviewSession');
    setCurrentStep('setup');
    setSessionId('');
    setMessages([]);
    setCurrentMessage('');
    setSessionState(null);
    setEvaluation(null);
  };

  if (currentStep === 'setup') {
    return (
      <div className="app">
        <div className="container">
          <header className="header">
            <h1>Interview Practice Partner</h1>
            <p>AI-powered mock interviews with agentic behavior</p>
          </header>

          <div className="workflow-container">
            <div className="workflow-steps">
              <div className="step active">
                <div className="step-number">1</div>
                <div className="step-title">Configure Interview</div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-title">Conduct Interview</div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-title">Review Results</div>
              </div>
            </div>
          </div>

          <div className="setup-form">
            <div className="form-group">
              <label>Your Name (Optional)</label>
              <input
                type="text"
                value={config.candidateName || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, candidateName: e.target.value }))}
                placeholder="Enter your name"
              />
            </div>

            <div className="form-group">
              <label>Email (Optional - for session recovery)</label>
              <input
                type="email"
                value={config.candidateEmail || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, candidateEmail: e.target.value }))}
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select
                value={config.role}
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                <option value="Software Engineer">Software Engineer</option>
                <option value="Product Manager">Product Manager</option>
                <option value="Sales Representative">Sales Representative</option>
                <option value="Marketing Manager">Marketing Manager</option>
                <option value="Data Scientist">Data Scientist</option>
                <option value="Designer">Designer</option>
                <option value="Consultant">Consultant</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Seniority Level *</label>
              <select
                value={config.seniority}
                onChange={(e) => setConfig(prev => ({ ...prev, seniority: e.target.value }))}
              >
                {getAvailableSeniorities().map(seniority => (
                  <option key={seniority} value={seniority}>{seniority}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Interview Types * <span className="help-text">(Available for {config.role})</span></label>
              <div className="checkbox-group">
                {getAvailableInterviewTypes().map(type => (
                  <label key={type} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.interviewTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig(prev => ({ ...prev, interviewTypes: [...prev.interviewTypes, type] }));
                        } else {
                          setConfig(prev => ({ ...prev, interviewTypes: prev.interviewTypes.filter(t => t !== type) }));
                        }
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Company (Optional)</label>
              <input
                type="text"
                value={config.company || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, company: e.target.value }))}
                placeholder="e.g., Google, Meta, Amazon"
              />
            </div>

            <div className="form-group">
              <label>Duration (Minutes)</label>
              <select
                value={config.durationMinutes}
                onChange={(e) => setConfig(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
              >
                <option value={5}>5 minutes (Demo)</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div className="form-group">
              <div className="label-with-help">
                <label>Interview Mode *</label>
                <button
                  type="button"
                  className="help-trigger"
                  onClick={() => setShowHelpModal(true)}
                  title="Learn how each mode works"
                >
                  How does this work?
                </button>
              </div>
              <div className="mode-selection">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="interviewMode"
                    value="practice"
                    checked={config.interviewMode === 'practice'}
                    onChange={(e) => setConfig(prev => ({ ...prev, interviewMode: e.target.value as 'practice' | 'mock' }))}
                  />
                  <div className="mode-content">
                    <strong>Practice Mode</strong>
                    <p>Get immediate feedback, scores, and 5 sample answers after each response. Perfect for learning!</p>
                  </div>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="interviewMode"
                    value="mock"
                    checked={config.interviewMode === 'mock'}
                    onChange={(e) => setConfig(prev => ({ ...prev, interviewMode: e.target.value as 'practice' | 'mock' }))}
                  />
                  <div className="mode-content">
                    <strong>Mock Interview</strong>
                    <p>Realistic interview simulation. Feedback provided only at the end, like a real interview.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Question Familiarity</label>
              <select
                value={config.questionFamiliarity}
                onChange={(e) => setConfig(prev => ({ ...prev, questionFamiliarity: e.target.value }))}
              >
                <option value="known">Known patterns</option>
                <option value="mixed">Mixed (some known, some new)</option>
                <option value="unique">Unique questions</option>
              </select>
            </div>

            <button 
              className="start-button" 
              onClick={startInterview}
              disabled={isLoading || config.interviewTypes.length === 0 || apiStatus !== 'connected'}
            >
              {isLoading ? `Starting ${config.interviewMode === 'practice' ? 'Practice' : 'Mock Interview'}...` : `Start ${config.interviewMode === 'practice' ? 'Practice Mode' : 'Mock Interview'}`}
            </button>
          </div>
        </div>

        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          mode={config.interviewMode}
        />
      </div>
    );
  }

  if (currentStep === 'interview') {
    return (
      <div className="app">
        <div className="container">
          <header className="interview-header">
            <div className="interview-header-top">
              <h2>Interview in Progress</h2>
              <button 
                className="exit-button"
                onClick={() => {
                  if (confirm('Are you sure you want to exit the interview? Your progress will be saved.')) {
                    setCurrentStep('setup');
                  }
                }}
                title="Exit Interview"
              >
                Exit to Home
              </button>
            </div>
            
            <div className="workflow-container">
              <div className="workflow-steps">
                <div className="step completed">
                  <div className="step-number">1</div>
                  <div className="step-title">Configure Interview</div>
                </div>
                <div className="step active">
                  <div className="step-number">2</div>
                  <div className="step-title">Conduct Interview</div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-title">Review Results</div>
                </div>
              </div>
            </div>
            
            <div className="interview-info">
              <span>Role: {config.role}</span>
              <span>Level: {config.seniority}</span>
              <span>Phase: {sessionState?.phase}</span>
              <span>Questions: {sessionState?.questionsAsked}</span>
              <span>Duration: {config.durationMinutes} min</span>
            </div>
          </header>

          <div className="chat-container">
            <div className="messages">
              {messages.map((message, index) => {
                // Calculate elapsed time from previous message
                let elapsedTime = '';
                if (index > 0) {
                  const prevTime = new Date(messages[index - 1].timestamp).getTime();
                  const currTime = new Date(message.timestamp).getTime();
                  const secondsElapsed = Math.round((currTime - prevTime) / 1000);
                  elapsedTime = `+${secondsElapsed}s`;
                }
                
                return (
                  <div key={index} className={`message ${message.role}`}>
                    <div className="message-header">
                      <strong>{message.role === 'user' ? 'You' : 'AI Interviewer'}</strong>
                      <span className="timestamp">
                        {new Date(message.timestamp).toLocaleTimeString()}
                        {elapsedTime && <span className="elapsed-time" title="Time since last message"> ({elapsedTime})</span>}
                      </span>
                    </div>
                    <div className="message-content">{message.content}</div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="message assistant">
                  <div className="message-header">
                    <strong>AI Interviewer</strong>
                  </div>
                  <div className="message-content typing">Thinking...</div>
                </div>
              )}
            </div>

            <VoiceControls
              onTranscript={handleVoiceTranscript}
              onVoiceModeChange={handleVoiceModeChange}
              isListening={isListening}
              isVoiceEnabled={isVoiceEnabled}
            />

            <div className="input-area">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isVoiceEnabled ? "Speak using the microphone or type here..." : "Type your response... (Press Enter to send, Shift+Enter for new line)"}
                disabled={isLoading}
                rows={3}
              />
              <button onClick={sendMessage} disabled={isLoading || !currentMessage.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'evaluation') {
    return (
      <div className="app">
        <div className="container">
          <header className="header">
            <h1>Interview Complete!</h1>
            <p>Here's your performance evaluation</p>
          </header>

          <div className="workflow-container">
            <div className="workflow-steps">
              <div className="step completed">
                <div className="step-number">1</div>
                <div className="step-title">Configure Interview</div>
              </div>
              <div className="step completed">
                <div className="step-number">2</div>
                <div className="step-title">Conduct Interview</div>
              </div>
              <div className="step active">
                <div className="step-number">3</div>
                <div className="step-title">Review Results</div>
              </div>
            </div>
          </div>

          <div className="evaluation-container">
            {evaluation?.overall && (
              <div className="evaluation-section">
                <h3>Overall Assessment</h3>
                <div className="score">Score: {evaluation.overall.score}/5</div>
                <div className="recommendation">
                  Recommendation: <strong>{evaluation.overall.recommendation}</strong>
                </div>
                
                {evaluation.overall.strengths && (
                  <div>
                    <h4>Strengths:</h4>
                    <ul>
                      {evaluation.overall.strengths.map((strength: string, index: number) => (
                        <li key={index}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.overall.improvements && (
                  <div>
                    <h4>Areas for Improvement:</h4>
                    <ul>
                      {evaluation.overall.improvements.map((improvement: string, index: number) => (
                        <li key={index}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.overall.detailedFeedback && (
                  <div>
                    <h4>Detailed Feedback:</h4>
                    <p>{evaluation.overall.detailedFeedback}</p>
                  </div>
                )}
              </div>
            )}

            <div className="evaluation-categories">
              {evaluation?.communication && (
                <div className="category">
                  <h4>Communication: {evaluation.communication.score}/5</h4>
                  <p>{evaluation.communication.feedback}</p>
                </div>
              )}
              
              {evaluation?.technicalDepth && (
                <div className="category">
                  <h4>Technical Depth: {evaluation.technicalDepth.score}/5</h4>
                  <p>{evaluation.technicalDepth.feedback}</p>
                </div>
              )}
              
              {evaluation?.problemSolving && (
                <div className="category">
                  <h4>Problem Solving: {evaluation.problemSolving.score}/5</h4>
                  <p>{evaluation.problemSolving.feedback}</p>
                </div>
              )}
              
              {evaluation?.leadership && (
                <div className="category">
                  <h4>Leadership: {evaluation.leadership.score}/5</h4>
                  <p>{evaluation.leadership.feedback}</p>
                </div>
              )}
            </div>

            <button className="start-button" onClick={resetInterview}>
              Start New Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
