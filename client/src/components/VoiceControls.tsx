import React, { useState, useEffect, useRef } from 'react';

interface VoiceControlsProps {
  onTranscript: (text: string) => void;
  onVoiceModeChange: (enabled: boolean) => void;
  isListening: boolean;
  isVoiceEnabled: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscript,
  onVoiceModeChange,
  isListening,
  isVoiceEnabled
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if Speech Recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      // Initialize speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        // Recognition ended, update UI state if needed
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser. Try Chrome or Edge.');
    }
  }, [onTranscript]);

  const startListening = () => {
    if (recognitionRef.current && isSupported) {
      setError('');
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Failed to start speech recognition');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const toggleVoiceMode = () => {
    const newVoiceMode = !isVoiceEnabled;
    onVoiceModeChange(newVoiceMode);
    
    if (!newVoiceMode && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  if (!isSupported) {
    return (
      <div className="voice-controls">
        <div className="voice-error">
          🎤❌ Voice mode not supported in this browser. 
          Try Chrome, Edge, or Safari for voice features.
        </div>
      </div>
    );
  }

  return (
    <div className="voice-controls">
      <button
        className={`voice-toggle ${isVoiceEnabled ? 'enabled' : 'disabled'}`}
        onClick={toggleVoiceMode}
        title={isVoiceEnabled ? 'Disable voice mode' : 'Enable voice mode'}
      >
        {isVoiceEnabled ? '🎤 Voice ON' : '🎤 Voice OFF'}
      </button>

      {isVoiceEnabled && (
        <>
          <button
            className={`voice-button ${isListening ? 'listening' : ''}`}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            disabled={!isSupported}
            title="Hold to speak"
          >
            {isListening ? '🎤 Listening...' : '🎤 Hold to Speak'}
          </button>

          <div className="voice-status">
            {isListening ? (
              <span className="listening-indicator">🔴 Listening...</span>
            ) : (
              <span className="idle-indicator">Hold the microphone button and speak</span>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="voice-error">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default VoiceControls;
