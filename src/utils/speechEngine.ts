// Web Speech API interfaces typing
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechEngineOptions {
  onUserSpeechResult: (text: string, isFinal: boolean) => void;
  onUserSpeechStart?: () => void;
  onAssistantStartSpeaking?: () => void;
  onAssistantEndSpeaking?: () => void;
  onError?: (err: string) => void;
}

export class SpeechEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private options: SpeechEngineOptions;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private speechRate: number = 0.9;

  constructor(options: SpeechEngineOptions) {
    this.options = options;
    this.initVoices();
    this.initRecognition();
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer Google or Natural English voices if available
      const enVoices = voices.filter((v) => v.lang.startsWith('en'));
      this.preferredVoice =
        enVoices.find((v) => v.name.includes('Google') || v.name.includes('Natural')) ||
        enVoices.find((v) => v.default) ||
        enVoices[0] ||
        null;
    };

    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Web Speech Recognition API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onsoundstart = () => {
        // User started making sound/speaking!
        // BARGE-IN: If assistant is currently speaking, interrupt assistant immediately!
        if (this.isSpeaking) {
          this.stopSpeaking();
        }
        if (this.options.onUserSpeechStart) {
          this.options.onUserSpeechStart();
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Barge-in check
        if ((interimTranscript.trim() || finalTranscript.trim()) && this.isSpeaking) {
          this.stopSpeaking();
        }

        if (finalTranscript.trim()) {
          this.options.onUserSpeechResult(finalTranscript.trim(), true);
        } else if (interimTranscript.trim()) {
          this.options.onUserSpeechResult(interimTranscript.trim(), false);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error('Speech recognition error:', event.error);
          if (this.options.onError) {
            this.options.onError(`Microphone note: ${event.error}`);
          }
        }
      };

      this.recognition.onend = () => {
        // Auto restart recognition if active
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            // ignore
          }
        }
      };
    } catch (err: any) {
      console.error('Failed to init speech recognition:', err);
    }
  }

  public setSpeechRate(rate: number) {
    this.speechRate = rate;
  }

  public isRecognitionSupported(): boolean {
    return !!(typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition));
  }

  public startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      // Already running or starting
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
  }

  public speak(text: string, rate?: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Interrupt any active speech first
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate ?? this.speechRate;
    utterance.pitch = 1.0;

    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.options.onAssistantStartSpeaking) {
        this.options.onAssistantStartSpeaking();
      }
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (this.options.onAssistantEndSpeaking) {
        this.options.onAssistantEndSpeaking();
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (this.options.onAssistantEndSpeaking) {
        this.options.onAssistantEndSpeaking();
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (this.options.onAssistantEndSpeaking) {
        this.options.onAssistantEndSpeaking();
      }
    }
  }

  public destroy() {
    this.stopListening();
    this.stopSpeaking();
  }
}
