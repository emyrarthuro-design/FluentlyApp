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
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const liveEngineRef = useRef<LiveVoiceEngine | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Speed rate multiplier based on level
  const speechRate = React.useMemo(() => {
    switch (level) {
      case 'A1':
        return 0.82;
      case 'A2':
        return 0.86;
      case 'B1':
        return 0.92;
      case 'B2':
        return 0.98;
      case 'C1':
      case 'C2':
      default:
        return 1.0;
    }
  }, [level]);

  // Speed rate label for display based on level
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

  // Scroll to bottom on transcript update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentAssistantText, currentUserDraft]);

  // Initialize Gemini Live Voice Engine
  useEffect(() => {
    let canceled = false;

    const engine = new LiveVoiceEngine({
      level,
      onConnected: () => {
        if (!canceled) {
          setIsConnected(true);
          setErrorMessage(null);
        }
      },
      onAudioLevel: (vol) => {
        if (!canceled) {
          setAudioVolume(vol);
        }
      },
      onMicStateChange: (active) => {
        if (!canceled) {
          setIsListening(active);
        }
      },
      onUserTranscript: (text, isFinal) => {
        if (canceled) return;
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
        if (canceled) return;
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
        if (!canceled) {
          setIsAssistantSpeaking(true);
        }
      },
      onAssistantEndSpeaking: () => {
        if (!canceled) {
          setIsAssistantSpeaking(false);
        }
      },
      onError: (err) => {
        if (!canceled) {
          console.error('Voice engine error:', err);
          setErrorMessage(err);
        }
      },
    });

    liveEngineRef.current = engine;

    // Connect to Live WebSocket
    engine
      .connect()
      .then(async () => {
        if (!canceled) {
          await engine.unlockAudio();
          await engine.startMicrophone();
        } else {
          engine.destroy();
        }
      })
      .catch((err) => {
        if (!canceled) {
          console.error('Failed to establish Gemini Live voice connection:', err);
          setErrorMessage(err?.message || 'Error al conectar con la API de voz en tiempo real de Gemini.');
        }
      });

    return () => {
      canceled = true;
      engine.destroy();
      if (liveEngineRef.current === engine) {
        liveEngineRef.current = null;
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

  // User manual text message sent over Gemini Live WS
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

  // Quick Action: Repeat
  const handleRepeat = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage('Could you please repeat what you just said?');
    }
  };

  // Quick Action: Speak Slower
  const handleSlower = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage('Could you please speak a bit slower and simpler?');
    }
  };

  // Quick Action: Spanish Help (for A1, A2, B1)
  const handleSpanishHelp = () => {
    handleInterrupt();
    if (liveEngineRef.current) {
      liveEngineRef.current.sendTextMessage(
        'Could you please explain or translate that in Spanish for me?'
      );
    }
  };

  // Toggle Microphone
  const toggleListening = async () => {
    if (!liveEngineRef.current) return;
    setErrorMessage(null);
    await liveEngineRef.current.unlockAudio();
    const newListening = !isListening;
    liveEngineRef.current.toggleMicrophone(newListening);
  };

  const handleActivateMicrophone = async () => {
    if (!liveEngineRef.current) return;
    setErrorMessage(null);
    await liveEngineRef.current.unlockAudio();
    await liveEngineRef.current.startMicrophone();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white border-3 border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B] font-black">
            {level}
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Práctica de Voz Gemini Live Real-Time
            </span>
            <span className="text-sm font-bold text-gray-800">
              Nivel seleccionado: {level}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-gray-500 font-semibold">
            Ritmo: {speedLabel}
          </span>
          <button
            onClick={() => {
              handleInterrupt();
              if (liveEngineRef.current) {
                liveEngineRef.current.destroy();
              }
              onEndSession(messages);
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-gray-700" />
            Finalizar Sesión
          </button>
        </div>
      </div>

      {/* Main Voice Interactive Status Card */}
      <div className="bg-white border-4 border-[#FF6B6B] rounded-[32px] p-6 sm:p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          {/* Main Visual Pulse Circle */}
          <div className="relative mb-4">
            <div
              className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
                isAssistantSpeaking
                  ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/40 scale-105'
                  : isListening
                  ? audioVolume > 8
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-105'
                    : 'bg-[#6BCBCA] text-white shadow-lg shadow-[#6BCBCA]/40'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isAssistantSpeaking ? (
                <Volume2 className="w-14 h-14 sm:w-16 sm:h-16 animate-bounce" />
              ) : isListening ? (
                <Mic className={`w-14 h-14 sm:w-16 sm:h-16 ${audioVolume > 8 ? 'scale-110 text-white' : 'animate-pulse'}`} />
              ) : (
                <MicOff className="w-14 h-14 sm:w-16 sm:h-16" />
              )}
            </div>

            {/* Pulsing ring animation */}
            {(isAssistantSpeaking || isListening) && (
              <div
                className={`absolute inset-0 rounded-full border-4 animate-ping opacity-30 ${
                  isAssistantSpeaking
                    ? 'border-[#FF6B6B]'
                    : audioVolume > 8
                    ? 'border-emerald-400'
                    : 'border-[#6BCBCA]'
                }`}
              />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-800">Tutor de Inglés Gemini Live</h2>

          {/* Real-time Status Label */}
          <div className="mt-1 flex flex-col items-center gap-2">
            <p className="text-xs sm:text-sm font-bold">
              {isAssistantSpeaking ? (
                <span className="text-[#FF6B6B]">Hablando voz nativa IA...</span>
              ) : isListening ? (
                audioVolume > 8 ? (
                  <span className="text-emerald-600 font-extrabold flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    ¡Capturando tu voz ({audioVolume}%)!
                  </span>
                ) : (
                  <span className="text-teal-700 font-bold">
                    Escuchando tu voz... (Habla cuando gustes)
                  </span>
                )
              ) : !isConnected ? (
                <span className="text-gray-500">Conectando sesión de voz Gemini Live...</span>
              ) : (
                <span className="text-amber-700">Micrófono pausado en tu celular</span>
              )}
            </p>

            {/* Real-time Voice Volume Equalizer Bars */}
            {isListening && (
              <div className="flex items-center gap-1 h-6 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 mr-1">Micrófono:</span>
                {[0.2, 0.4, 0.7, 0.5, 0.3].map((factor, idx) => {
                  const barHeight = Math.max(4, Math.min(20, Math.round((audioVolume * factor * 20) / 30) + 4));
                  return (
                    <div
                      key={idx}
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        audioVolume > 8 ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                      style={{ height: `${barHeight}px` }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Controls: Mute/Interrupt and Mic toggle */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-5">
            {isConnected && !isListening && (
              <button
                onClick={handleActivateMicrophone}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all flex items-center gap-2 text-sm cursor-pointer shadow-lg shadow-emerald-600/30 animate-bounce"
              >
                <Mic className="w-5 h-5" />
                <span>Toca para activar micrófono</span>
              </button>
            )}

            <button
              onClick={toggleListening}
              disabled={!isConnected}
              className={`px-5 py-3.5 rounded-2xl font-bold transition-all flex items-center gap-2 text-sm cursor-pointer shadow-sm disabled:opacity-50 ${
                isListening
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isListening ? (
                <>
                  <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                  <span>Micrófono Activo</span>
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5" />
                  <span>Activar Micrófono</span>
                </>
              )}
            </button>

            {isAssistantSpeaking && (
              <button
                onClick={handleInterrupt}
                className="px-5 py-3.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-2xl font-bold transition-all flex items-center gap-2 text-sm cursor-pointer animate-pulse"
              >
                <VolumeX className="w-5 h-5" />
                <span>Interrumpir</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold block">{errorMessage}</span>
              <span className="text-[11px] text-red-600">
                Si estás en el celular, verifica los permisos del navegador (Chrome/Safari) y toca &quot;Activar Micrófono&quot;.
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              setErrorMessage(null);
              if (liveEngineRef.current) {
                await liveEngineRef.current.unlockAudio();
                await liveEngineRef.current.startMicrophone();
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Activar Micrófono</span>
          </button>
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
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 font-bold rounded-lg text-amber-900 transition-colors shrink-0"
            >
              Ayuda en español
            </button>
          )}
        </div>
      )}

      {/* Transcript Container */}
      <div className="bg-white border-4 border-[#6BCBCA] rounded-[32px] p-6 shadow-lg space-y-4 relative">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6BCBCA] flex items-center justify-between border-b border-gray-100 pb-2">
          <span>Transcripción Gemini Live</span>
          <span className="text-gray-400 font-normal tracking-normal lowercase">en tiempo real</span>
        </div>

        <div
          ref={chatContainerRef}
          className="max-h-80 min-h-48 overflow-y-auto space-y-4 pr-2"
        >
          {!isConnected && (
            <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#6BCBCA] animate-spin" />
              <span className="font-semibold">Estableciendo conexión de voz en tiempo real con Gemini...</span>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
                  {isUser ? 'Tú (Estudiante)' : 'Tutor Gemini Live'}
                </span>
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#FF6B6B] text-white rounded-br-none shadow-xs font-medium'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none font-medium'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}

          {currentUserDraft && (
            <div className="flex flex-col items-end opacity-80">
              <span className="text-[10px] font-bold text-[#6BCBCA] uppercase tracking-wider mb-1 px-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-[#6BCBCA] rounded-full animate-ping" />
                Procesando voz...
              </span>
              <div className="p-4 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed bg-[#6BCBCA]/20 text-teal-900 border border-[#6BCBCA]/40 italic rounded-br-none">
                {currentUserDraft}...
              </div>
            </div>
          )}

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

        {/* Quick Action Buttons Row */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={handleSlower}
            disabled={!isConnected}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Gauge className="w-4 h-4 text-amber-600" />
            <span>Más despacio</span>
          </button>

          <button
            onClick={handleRepeat}
            disabled={!isConnected}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-[#FF6B6B]" />
            <span>Repetir</span>
          </button>

          {['A1', 'A2', 'B1'].includes(level) && (
            <button
              onClick={handleSpanishHelp}
              disabled={!isConnected}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Languages className="w-4 h-4 text-teal-600" />
              <span>Ayuda en español</span>
            </button>
          )}

          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4 text-blue-600" />
            <span>Escribir texto</span>
          </button>
        </div>

        {/* Text input fallback toggle */}
        {showTextInput && (
          <div className="pt-2 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUserSendMessage(textInput);
              }}
              placeholder="Enviar texto a la sesión Gemini Live..."
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#FF6B6B]"
            />
            <button
              onClick={() => handleUserSendMessage(textInput)}
              disabled={!textInput.trim() || !isConnected}
              className="px-4 py-2.5 bg-[#FF6B6B] hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
