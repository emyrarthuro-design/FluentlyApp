export interface LiveVoiceEngineOptions {
  level: string;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onAssistantTranscript: (text: string, isFinal: boolean) => void;
  onAssistantStartSpeaking: () => void;
  onAssistantEndSpeaking: () => void;
  onError: (error: string) => void;
  onConnected?: () => void;
  onAudioLevel?: (volumePercent: number) => void;
  onMicStateChange?: (active: boolean) => void;
}

export class LiveVoiceEngine {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private muteGainNode: GainNode | null = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private options: LiveVoiceEngineOptions;
  private currentAssistantChunkText: string = '';
  private currentUserChunkText: string = '';

  constructor(options: LiveVoiceEngineOptions) {
    this.options = options;
  }

  public async unlockAudio(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.inputAudioCtx && AudioContextClass) {
        this.inputAudioCtx = new AudioContextClass();
      }
      if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (!this.outputAudioCtx && AudioContextClass) {
        this.outputAudioCtx = new AudioContextClass();
      }
      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  public async connect(retries = 3): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live?level=${encodeURIComponent(this.options.level)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.ws = new WebSocket(wsUrl);

          this.ws.onopen = () => {
            console.log(`Connected to Gemini Live WebSocket (Attempt ${attempt})`);
            if (this.options.onConnected) {
              this.options.onConnected();
            }
            resolve();
          };

          this.ws.onmessage = (event) => {
            this.handleServerMessage(event.data);
          };

          this.ws.onerror = (err) => {
            console.warn(`WebSocket error on attempt ${attempt}:`, err);
            reject(err);
          };

          this.ws.onclose = () => {
            console.log('WebSocket connection closed.');
          };
        });

        // Connection successful, break retry loop
        return;
      } catch (e: any) {
        if (attempt < retries) {
          console.log(`Retrying Gemini Live WebSocket connection (${attempt}/${retries})...`);
          await new Promise((res) => setTimeout(res, 1000));
        } else {
          console.error('All Gemini Live WebSocket connection attempts failed.');
          this.options.onError('No se pudo establecer la conexión de voz Gemini Live. Revisa tu red o intenta de nuevo.');
          throw e;
        }
      }
    }
  }

  public async startMicrophone(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.options.onError(
          'Tu navegador no soporta captura de micrófono o la página requiere HTTPS. Por favor usa Chrome o Safari en tu celular.'
        );
        return;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        this.options.onError('Tu navegador no soporta Web Audio API.');
        return;
      }

      if (!this.inputAudioCtx) {
        this.inputAudioCtx = new AudioContextClass();
      }
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.warn('Fallback to basic audio getUserMedia:', err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.mediaStream = stream;
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(stream);
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      // Create a 0-gain node to route audio without playing it through speakers on mobile
      this.muteGainNode = this.inputAudioCtx.createGain();
      this.muteGainNode.gain.value = 0;

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isListening || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          if (this.options.onAudioLevel) {
            this.options.onAudioLevel(0);
          }
          return;
        }

        const inputBuffer = e.inputBuffer.getChannelData(0);

        // Calculate live volume level for UI feedback
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        const volumeLevel = Math.min(100, Math.round(rms * 450));

        if (this.options.onAudioLevel) {
          this.options.onAudioLevel(volumeLevel);
        }

        const sampleRate = this.inputAudioCtx?.sampleRate || 44100;
        const resampled = this.resampleFloat32Array(inputBuffer, sampleRate, 16000);
        const pcmBuffer = this.floatTo16BitPCM(resampled);
        const base64PCM = this.arrayBufferToBase64(pcmBuffer);

        this.ws.send(JSON.stringify({ type: 'audio', data: base64PCM }));
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.muteGainNode);
      this.muteGainNode.connect(this.inputAudioCtx.destination);

      this.isListening = true;
      if (this.options.onMicStateChange) {
        this.options.onMicStateChange(true);
      }
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      let errorMsg = 'No se pudo acceder al micrófono.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Permiso de micrófono denegado. Por favor permite el acceso al micrófono en los ajustes de tu navegador.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No se encontró ningún micrófono en tu dispositivo.';
      }
      this.options.onError(errorMsg);
    }
  }

  public stopMicrophone(): void {
    this.isListening = false;
    if (this.options.onMicStateChange) {
      this.options.onMicStateChange(false);
    }
    if (this.options.onAudioLevel) {
      this.options.onAudioLevel(0);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.muteGainNode) {
      this.muteGainNode.disconnect();
      this.muteGainNode = null;
    }
  }

  public toggleMicrophone(active: boolean): void {
    if (active) {
      this.startMicrophone();
    } else {
      this.stopMicrophone();
    }
  }

  public sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.stopSpeaking();
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  public sendInterruptSignal(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  }

  public stopSpeaking(): void {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // ignore
      }
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.options.onAssistantEndSpeaking();
    }
  }

  private handleServerMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'audio') {
        this.playAudioChunk(msg.data);
      } else if (msg.type === 'model_text' || msg.type === 'output_transcript') {
        if (msg.text) {
          this.currentAssistantChunkText += msg.text;
          this.options.onAssistantTranscript(this.currentAssistantChunkText, false);
        }
      } else if (msg.type === 'input_transcript') {
        if (msg.text) {
          this.currentUserChunkText += msg.text;
          this.options.onUserTranscript(this.currentUserChunkText, false);
        }
      } else if (msg.type === 'interrupted') {
        this.stopSpeaking();
      } else if (msg.type === 'error') {
        this.options.onError(msg.text || msg.message || 'Error desconocido de Gemini Live');
      } else if (msg.type === 'turn_complete') {
        if (this.currentAssistantChunkText) {
          this.options.onAssistantTranscript(this.currentAssistantChunkText, true);
          this.currentAssistantChunkText = '';
        }
        if (this.currentUserChunkText) {
          this.options.onUserTranscript(this.currentUserChunkText, true);
          this.currentUserChunkText = '';
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  }

  private async playAudioChunk(base64Data: string): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.outputAudioCtx && AudioContextClass) {
        // Do not pass sampleRate: 24000 to AudioContext constructor on iOS / mobile!
        this.outputAudioCtx = new AudioContextClass();
      }
      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      if (!this.outputAudioCtx) return;

      const float32Data = this.base64ToFloat32Array(base64Data);
      if (float32Data.length === 0) return;

      // The raw PCM from Gemini Live native audio is 24000Hz mono.
      // createBuffer with 24000 tells Web Audio API the source rate, and it will smoothly resample to device rate.
      const buffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);

      const now = this.outputAudioCtx.currentTime;
      const startTime = Math.max(now, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;

      this.activeSources.push(source);

      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.options.onAssistantStartSpeaking();
      }

      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
        if (
          this.activeSources.length === 0 &&
          this.outputAudioCtx &&
          this.outputAudioCtx.currentTime >= this.nextStartTime
        ) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.options.onAssistantEndSpeaking();
          }
        }
      };
    } catch (e) {
      console.error('Error playing audio chunk:', e);
    }
  }

  private resampleFloat32Array(
    input: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array {
    if (fromSampleRate === toSampleRate) return input;
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originIndex = i * ratio;
      const index = Math.floor(originIndex);
      const decimal = originIndex - index;
      const nextIndex = Math.min(index + 1, input.length - 1);
      result[i] = input[index] * (1 - decimal) + input[nextIndex] * decimal;
    }
    return result;
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToFloat32Array(base64: string): Float32Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const dataView = new DataView(bytes.buffer);
    const numSamples = Math.floor(bytes.length / 2);
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      float32[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }
    return float32;
  }

  public destroy(): void {
    this.stopMicrophone();
    this.stopSpeaking();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }
}
