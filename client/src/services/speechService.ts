export class SpeechService {
  private synth: SpeechSynthesis;
  private defaultVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    this.initializeVoices();
  }

  private initializeVoices() {
    // Wait for voices to load
    if (this.synth.getVoices().length === 0) {
      this.synth.addEventListener('voiceschanged', () => {
        this.setDefaultVoice();
      });
    } else {
      this.setDefaultVoice();
    }
  }

  private setDefaultVoice() {
    const voices = this.synth.getVoices();
    
    // Prefer female voices for professional interview feel
    this.defaultVoice = 
      voices.find(voice => voice.name.includes('Female')) ||
      voices.find(voice => voice.name.includes('Samantha')) ||
      voices.find(voice => voice.name.includes('Karen')) ||
      voices.find(voice => voice.name.includes('Victoria')) ||
      voices.find(voice => voice.lang.startsWith('en') && voice.name.includes('Google')) ||
      voices.find(voice => voice.lang.startsWith('en')) ||
      voices[0] ||
      null;
  }

  public speak(text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice and options
      if (this.defaultVoice) {
        utterance.voice = this.defaultVoice;
      }
      
      utterance.rate = options?.rate || 0.9; // Slightly slower for interview feel
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 0.8;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Speech error: ${event.error}`));

      this.synth.speak(utterance);
    });
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synth ? this.synth.getVoices() : [];
  }

  public isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
}

export default SpeechService;
