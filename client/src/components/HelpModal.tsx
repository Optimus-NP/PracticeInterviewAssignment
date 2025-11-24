import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'practice' | 'mock';
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, mode }) => {
  if (!isOpen) return null;

  const practiceContent = (
    <div className="help-content">
      <h3>📚 Practice Mode - How It Works</h3>
      
      <div className="help-section">
        <h4>🎯 Purpose</h4>
        <p>Learn and improve your interview skills with immediate feedback after each response.</p>
      </div>

      <div className="help-section">
        <h4>💬 What Happens</h4>
        <ol>
          <li><strong>AI asks a question</strong> - Appropriate for your role and seniority</li>
          <li><strong>You respond</strong> - Via text or voice (your choice)</li>
          <li><strong>Instant feedback</strong> - Score (1-5) + detailed assessment</li>
          <li><strong>5 sample answers</strong> - From basic to excellent examples</li>
          <li><strong>Improvement tips</strong> - Specific ways to enhance your response</li>
          <li><strong>Next question</strong> - Continue practicing new topics</li>
        </ol>
      </div>

      <div className="help-section">
        <h4>✨ Best For</h4>
        <ul>
          <li>🎓 <strong>Learning</strong> - First time preparing for interviews</li>
          <li>🔄 <strong>Skill building</strong> - Want to see examples and improve</li>
          <li>📖 <strong>Education</strong> - Understanding what makes a great answer</li>
          <li>⚡ <strong>Quick practice</strong> - Short sessions with immediate learning</li>
        </ul>
      </div>

      <div className="help-section">
        <h4>📝 Example Flow</h4>
        <div className="example-flow">
          <div className="example-step">
            <strong>🤖 AI:</strong> "Tell me about a challenging project you worked on"
          </div>
          <div className="example-step">
            <strong>👤 You:</strong> "I worked on a difficult API integration..."
          </div>
          <div className="example-step feedback">
            <strong>📊 AI Feedback:</strong>
            <br/>Score: 3/5 - Good technical detail, but missing impact metrics
            <br/><strong>Sample Answer:</strong> "I led the integration of a complex third-party API that reduced processing time by 60%..."
            <br/><strong>Improvement:</strong> Include quantifiable results and your specific role
          </div>
        </div>
      </div>
    </div>
  );

  const mockContent = (
    <div className="help-content">
      <h3>🎭 Mock Interview Mode - How It Works</h3>
      
      <div className="help-section">
        <h4>🎯 Purpose</h4>
        <p>Experience a realistic interview simulation exactly like the real thing.</p>
      </div>

      <div className="help-section">
        <h4>💬 What Happens</h4>
        <ol>
          <li><strong>Professional introduction</strong> - AI presents agenda and timeline</li>
          <li><strong>Natural conversation</strong> - Questions flow based on your responses</li>
          <li><strong>Intelligent follow-ups</strong> - AI decides when to dig deeper</li>
          <li><strong>Phase transitions</strong> - Moves through behavioral → technical → wrap-up</li>
          <li><strong>Realistic timing</strong> - Respects interview duration</li>
          <li><strong>Final evaluation</strong> - Comprehensive feedback at the end only</li>
        </ol>
      </div>

      <div className="help-section">
        <h4>✨ Best For</h4>
        <ul>
          <li>🎪 <strong>Final preparation</strong> - Before actual interviews</li>
          <li>⏱️ <strong>Timing practice</strong> - Experience real interview pacing</li>
          <li>🧠 <strong>Pressure simulation</strong> - Handle interview stress</li>
          <li>📊 <strong>Assessment</strong> - Gauge your current interview readiness</li>
        </ul>
      </div>

      <div className="help-section">
        <h4>🤖 Agentic AI Behavior</h4>
        <p>The AI interviewer makes intelligent decisions:</p>
        <ul>
          <li><strong>Follow-ups:</strong> "Can you be more specific about your role in that project?"</li>
          <li><strong>Clarification:</strong> "I want to make sure I understand - when you said 'optimized'..."</li>
          <li><strong>Phase changes:</strong> "Great behavioral examples! Let's move to technical questions."</li>
          <li><strong>Time management:</strong> "We have 10 minutes left, so let me ask about..."</li>
        </ul>
      </div>

      <div className="help-section">
        <h4>📝 Example Flow</h4>
        <div className="example-flow">
          <div className="example-step">
            <strong>🤖 AI:</strong> "Tell me about a time you led a challenging project"
          </div>
          <div className="example-step">
            <strong>👤 You:</strong> "I led our team through a tight deadline..."
          </div>
          <div className="example-step">
            <strong>🤖 AI:</strong> "That's interesting. What specific strategies did you use to keep the team motivated during that pressure?"
          </div>
          <div className="example-step">
            <strong>👤 You:</strong> "I organized daily check-ins and celebrated small wins..."
          </div>
          <div className="example-step">
            <strong>🤖 AI:</strong> "Excellent leadership approach. Now let's transition to some technical questions..."
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h2>❓ How to Use</h2>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>
        
        {mode === 'practice' ? practiceContent : mockContent}
        
        <div className="help-footer">
          <button className="help-button" onClick={onClose}>
            Got it! Let's Start
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
