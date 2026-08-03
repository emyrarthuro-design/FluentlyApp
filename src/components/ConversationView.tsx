import React, { useState, useEffect, useRef } from 'react';
import { EnglishLevel, ChatMessage } from '../types';
import { LiveVoiceEngine } from '../utils/liveVoiceEngine';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  RotateCcw,
  Gauge,
  Languages,
  Send,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Radio,
} from 'lucide-react';

interface ConversationViewProps {
  level: EnglishLevel;
  onEndSession: (history: ChatMessage[]) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  level,
  onEndSession,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);
  const [currentAssistantText, setCurrentAssistantText] = useState<string>('');
  const [currentUserDraft, setCurrentUserDraft] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [silenceCounter, setSilenceCounter] = useState<number>(0);

  const liveEngineRef = useRef<LiveVoiceEngine | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Speed rate label for display
  const speedLabel = React.useMemo(() => {
    switch (level) {
      case 'A1':
      case 'A2':
        return '82%';
      case 'B1':
        return '90%';
      case 'B2':
        return '98%';
      case 'C1':
      case 'C2':
      default:
        return '100%';
    }
  }, [level]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentAssistantText, currentUserDraft]);

  // Initialize Gemini Live Voice Engine on mount
  useEffect(() => {
    isMountedRef.current = true;

    const engine = new LiveVoiceEngine({
      level,
      onConnected: () => {
        if (isMountedRef.current) {
          setIsConnected(true);
        }
      },
      onUserTranscript: (text, isFinal) => {
        if (!isMountedRef.current) return;
        setSilenceCounter(0);
        if (isFinal) {
          if (text.trim()) {
            const userMsg: ChatMessage = {
              id: 'user-' + Date.now(),
              role: 'user',
              text: text.trim(),
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, userMsg]);
          }
          setCurrentUserDraft('');
        } else {
          setCurrentUserDraft(text);
        }
      },
      onAssistantTranscript: (text, isFinal) => {
        if (!isMountedRef.current) return;
        if (isFinal) {
          if (text.trim()) {
            const assistantMsg: ChatMessage = {
              id: 'msg-' + Date.now(),
              role: 'assistant',
              text: text.trim(),
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
          setCurrentAssistantText('');
        } else {
          setCurrentAssistantText(text);
        }
      },
      onAssistantStartSpeaking: () => {
        if (isMountedRef.current) {
          setIsAssistantSpeaking(true);
        }
      },
      onAssistantEndSpeaking: () => {
        if (isMountedRef.current) {
          setIsAssistantSpeaking(false);
        }
      },
      onError: (err) => {
        if (isMountedRef.current) {
          setErrorMessage(err);
        }
      },
    });

    liveEngineRef.current = engine;

    // Connect to WebSocket and start microphone
    engine
      .connect()
      .then(() => {
        if (isMountedRef.current) {
          engine.startMicrophone();
          setIsListening(true);
        }
      })
      .catch((err) => {
        console.error('Failed to establish live voice connection:', err);
      });

    return () => {
      isMountedRef.current = false;
      if (liveEngineRef.current) {
        liveEngineRef.current.destroy();
      }
    };
  }, [level]);

  // Silence timer monitor
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAssistantSpeaking && isListening && isConnected) {
        setSilenceCounter((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAssistantSpeaking, isListening, isConnected]);

  // Interrupt Assistant
  const handleInterrupt = () => {
    if (liveEngineRef.current) {
      liveEngineRef.current.stopSpeaking();
      liveEngineRef.current.sendInterruptSignal();
    }
    setIsAssistantSpeaking(false);
  };

  // User manual text message
  const handleUserSendMessage = (textToSend: string) => {
    if (!textToSend.trim() || !liveEngineRef.current) return;
    setSilenceCounter(0);

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: textToSend.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    liveEngineRef.current.sendTextMessage(textToSend.trim());
    setTextInput('');
  };

  // Quick Actions over voice
  const handleRepeat = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage('Could you please repeat what you just said?');
    }
  };

  const handleSlower = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage('Could you please speak a bit slower and simpler?');
    }
  };

  const handleSpanishHelp = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage(
        'Could you please explain or translate that in Spanish for me?'
      );
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (!liveEngineRef.current) return;
    const newListening = !isListening;
    setIsListening(newListening);
    liveEngineRef.current.toggleMicrophone(newListening);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Session Bar */}
      <div className="bg-white border-4 border-gray-100 p-4 sm:p-5 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-orange-100 border border-orange-200 text-orange-600 text-xs px-4 py-1.5 rounded-full font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#FF6B6B]" />
            <span>Nivel: {level}</span>
          </div>

          <span className="hidden sm:inline text-xs text-gray-500 font-semibold">
            Velocidad: {speedLabel}
          </span>
        </div>

        <button
          onClick={() => {
            handleInterrupt();
            if (liveEngineRef.current) {
              liveEngineRef.current.destroy();
            }
            onEndSession(messages);
          }}
          className="px-6 py-2.5 bg-[#FF6B6B] hover:bg-red-500 text-white font-black rounded-2xl text-xs shadow-md shadow-red-500/20 transform active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>TERMINAR SESIÓN</span>
        </button>
      </div>

      {/* Tutor Character Card & Audio Waveform */}
      <div className="bg-white border-4 border-[#FFD93D] rounded-[32px] p-6 sm:p-8 shadow-lg relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-50 rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-pink-50 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-28 h-28 sm:w-36 sm:h-36 bg-[#FF6B6B] rounded-full border-4 border-white shadow-xl flex items-center justify-center mb-4 relative overflow-hidden">
            {isAssistantSpeaking ? (
              <Volume2 className="w-14 h-14 text-white animate-bounce" />
            ) : (
              <Sparkles className="w-14 h-14 text-white" />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-800">Tutor de Inglés IA (Voz Real)</h2>
          <p className="text-xs sm:text-sm text-[#FF6B6B] font-bold mt-0.5">
            {isAssistantSpeaking
              ? 'Hablando directamente por voz...'
              : isListening
              ? 'Escuchando tu voz...'
              : !isConnected
              ? 'Conectando sesión de voz Gemini...'
              : 'Pausado'}
          </p>

          {/* Voice Waveform Animation */}
          <div className="flex items-center gap-1.5 h-10 mt-4">
            {[20, 50, 30, 80, 60, 90, 40, 70, 30, 60, 20].map((h, idx) => (
              <div
                key={idx}
                className={`w-2 rounded-full transition-all duration-200 ${
                  isAssistantSpeaking
                    ? 'bg-[#FF6B6B] animate-pulse'
                    : isListening
                    ? 'bg-[#6BCBCA] animate-pulse'
                    : 'bg-gray-200'
                }`}
                style={{
                  height: isAssistantSpeaking || isListening ? `${Math.max(10, h * 0.4)}px` : '8px',
                  animationDelay: `${idx * 0.08}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Interrupt Button overlay when assistant speaks */}
        {isAssistantSpeaking && (
          <button
            onClick={handleInterrupt}
            className="mt-4 px-5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-2xl transition-all border-2 border-[#FFD93D] cursor-pointer animate-bounce flex items-center gap-2 shadow-xs"
          >
            <VolumeX className="w-4 h-4 text-amber-700" />
            <span>Interrumpir al Asistente</span>
          </button>
        )}
      </div>

      {/* Live Interim Speech Preview */}
      {currentUserDraft && (
        <div className="p-4 bg-emerald-50 border-3 border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2 shadow-xs">
          <Mic className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
          <span>Escuchándote: <strong>"{currentUserDraft}"</strong></span>
        </div>
      )}

      {/* Patience prompt */}
      {silenceCounter > 8 && !isAssistantSpeaking && isListening && (
        <div className="p-4 bg-amber-50 border-3 border-[#FFD93D] rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">El tutor espera con paciencia. Habla con confianza o pide ayuda.</span>
          </div>
          {['A1', 'A2', 'B1'].includes(level) && (
            <button
              onClick={handleSpanishHelp}
              className="text-xs bg-[#FF6B6B] text-white px-3 py-1.5 rounded-xl font-bold hover:bg-red-500 transition-colors shrink-0 cursor-pointer"
            >
              Ayuda en español
            </button>
          )}
        </div>
      )}

      {/* Transcript Container with Vibrant Teal border */}
      <div className="bg-white border-4 border-[#6BCBCA] rounded-[32px] p-6 shadow-lg space-y-4 relative">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6BCBCA] flex items-center justify-between border-b border-gray-100 pb-2">
          <span>Transcripción en Vivo (Gemini Voice)</span>
          <span className="text-gray-400 font-normal tracking-normal lowercase">tiempo real</span>
        </div>

        <div
          ref={chatContainerRef}
          className="max-h-80 min-h-48 overflow-y-auto space-y-4 pr-2"
        >
          {!isConnected && (
            <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#6BCBCA] animate-spin" />
              <span className="font-semibold">Iniciando conexión de voz en tiempo real...</span>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {isUser ? 'Tú' : 'Tutor IA'}
                </span>
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-slate-100 text-gray-800 italic font-medium'
                      : 'bg-blue-50 border border-blue-100 text-gray-900 font-medium shadow-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {currentAssistantText && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-[#FF6B6B] uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-[#FF6B6B] rounded-full animate-ping" />
                <span>Tutor IA hablando...</span>
              </span>
              <div className="p-4 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed bg-blue-50 border border-blue-200 text-gray-900 font-medium shadow-xs">
                {currentAssistantText}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="bg-white border-4 border-gray-100 p-4 rounded-[32px] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleMic}
            className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              isListening
                ? 'bg-[#6BCBCA] text-white hover:bg-teal-500'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            <span>{isListening ? 'Micrófono Activo' : 'Activar Micrófono'}</span>
          </button>

          <button
            onClick={handleSlower}
            disabled={!isConnected}
            className="px-5 py-3 bg-[#F1F1F1] hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Gauge className="w-4 h-4 text-amber-600" />
            <span>Más despacio</span>
          </button>

          <button
            onClick={handleRepeat}
            disabled={!isConnected}
            className="px-5 py-3 bg-[#F1F1F1] hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-[#FF6B6B]" />
            <span>Repetir</span>
          </button>

          {['A1', 'A2', 'B1'].includes(level) && (
            <button
              onClick={handleSpanishHelp}
              disabled={!isConnected}
              className="px-5 py-3 bg-[#F1F1F1] hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Languages className="w-4 h-4 text-teal-600" />
              <span>Ayuda español</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setShowTextInput(!showTextInput)}
          className="text-xs text-[#FF6B6B] hover:text-red-700 font-bold cursor-pointer underline"
        >
          {showTextInput ? 'Ocultar teclado' : 'Escribir texto'}
        </button>
      </div>

      {/* Backup Text Input */}
      {showTextInput && (
        <div className="bg-white border-2 border-gray-200 p-3 rounded-2xl flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserSendMessage(textInput)}
            placeholder="Escribe tu mensaje en inglés aquí..."
            className="flex-1 text-xs sm:text-sm px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]"
          />
          <button
            onClick={() => handleUserSendMessage(textInput)}
            disabled={!textInput.trim() || !isConnected}
            className="px-5 py-2.5 bg-[#FF6B6B] hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Enviar</span>
          </button>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

