// High-fidelity Web Speech API (Synthesis & Recognition) Helper

export interface SpeechSynthOptions {
  text: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeechSynthesisActive(): boolean {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

export function speakText(options: SpeechSynthOptions): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (options.onEnd) options.onEnd();
    return;
  }

  try {
    // Cancel any previous active speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = 'en-US';
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferredVoice =
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Ava'))) ||
        voices.find((v) => v.lang.startsWith('en-US')) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      currentUtterance = null;
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      currentUtterance = null;
      console.warn('SpeechSynthesis error:', e);
      if (options.onError) options.onError(e);
      if (options.onEnd) options.onEnd();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Failed to speak text:', err);
    if (options.onError) options.onError(err);
    if (options.onEnd) options.onEnd();
  }
}

// Browser Speech Recognition (Web Speech API)
export class BrowserSpeechRecognizer {
  private recognition: any = null;
  private isRunning: boolean = false;
  private onTranscript: (text: string, isFinal: boolean) => void;
  private onError: (err: string) => void;

  constructor(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void
  ) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.init();
  }

  private init() {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.log('Browser SpeechRecognition not supported.');
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          this.onTranscript(finalTranscript.trim(), true);
        } else if (interimTranscript.trim()) {
          this.onTranscript(interimTranscript.trim(), false);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn('Browser SpeechRecognition error:', event.error);
      };

      rec.onend = () => {
        if (this.isRunning) {
          try {
            rec.start();
          } catch (e) {
            // Already started or busy
          }
        }
      };

      this.recognition = rec;
    } catch (e) {
      console.warn('Speech recognition init failed:', e);
    }
  }

  public start(): void {
    if (!this.recognition) return;
    this.isRunning = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Recognition start caught error:', e);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
  }

  public destroy(): void {
    this.stop();
    this.recognition = null;
  }
}
