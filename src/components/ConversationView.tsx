import React, { useState, useEffect, useRef } from 'react';
import { EnglishLevel, ChatMessage } from '../types';
import { SpeechEngine } from '../utils/speechEngine';
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
  const [isLoadingReply, setIsLoadingReply] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [silenceCounter, setSilenceCounter] = useState<number>(0);

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Speed rate based on level
  const speedRate = React.useMemo(() => {
    switch (level) {
      case 'A1':
      case 'A2':
        return 0.82;
      case 'B1':
        return 0.9;
      case 'B2':
        return 0.98;
      case 'C1':
      case 'C2':
      default:
        return 1.0;
    }
  }, [level]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentAssistantText, currentUserDraft]);

  // Handle incoming AI response
  const fetchAndPlayReply = async (
    chatHistory: ChatMessage[],
    userAction?: 'repeat' | 'slow_down' | 'help_spanish' | 'user_message'
  ) => {
    setIsLoadingReply(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory.map((m) => ({ role: m.role, text: m.text })),
          level,
          action: userAction,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener la respuesta del tutor.');
      }

      const data = await response.json();
      const replyText = data.reply || "Hello! It's great to meet you today. Tell me a bit about yourself!";

      if (!isMountedRef.current) return;

      const assistantMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        text: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentAssistantText(replyText);

      // Speak text aloud
      if (speechEngineRef.current) {
        speechEngineRef.current.speak(replyText, speedRate);
      }
    } catch (err: any) {
      console.error('Error fetching chat reply:', err);
      if (isMountedRef.current) {
        setErrorMessage(err.message || 'Error de conexión con el tutor de IA.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingReply(false);
      }
    }
  };

  // User message submit handler
  const handleUserSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Interrupt speech synthesis if running
    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
    }
    setIsAssistantSpeaking(false);

    // Reset silence tracker
    setSilenceCounter(0);

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: textToSend.trim(),
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setCurrentUserDraft('');
    setTextInput('');

    // Fetch tutor response
    fetchAndPlayReply(newHistory, 'user_message');
  };

  // Initialize speech engine on mount
  useEffect(() => {
    isMountedRef.current = true;

    const engine = new SpeechEngine({
      onUserSpeechResult: (text, isFinal) => {
        if (!isMountedRef.current) return;
        if (isFinal) {
          handleUserSendMessage(text);
        } else {
          setCurrentUserDraft(text);
        }
      },
      onUserSpeechStart: () => {
        if (!isMountedRef.current) return;
        setSilenceCounter(0);
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
        console.warn('Speech engine info:', err);
      },
    });

    engine.setSpeechRate(speedRate);
    speechEngineRef.current = engine;

    // Start microphone listening automatically
    engine.startListening();
    setIsListening(true);

    // Initial greeting from tutor
    fetchAndPlayReply([]);

    return () => {
      isMountedRef.current = false;
      if (speechEngineRef.current) {
        speechEngineRef.current.destroy();
      }
    };
  }, [level]);

  // Silence timer monitor
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAssistantSpeaking && !isLoadingReply && isListening) {
        setSilenceCounter((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAssistantSpeaking, isLoadingReply, isListening]);

  // Interrupt Assistant
  const handleInterrupt = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
    }
    setIsAssistantSpeaking(false);
  };

  // Quick Action: Repeat
  const handleRepeat = () => {
    handleInterrupt();
    fetchAndPlayReply(messages, 'repeat');
  };

  // Quick Action: Speak Slower
  const handleSlower = () => {
    handleInterrupt();
    fetchAndPlayReply(messages, 'slow_down');
  };

  // Quick Action: Spanish Help (for A1, A2, B1)
  const handleSpanishHelp = () => {
    handleInterrupt();
    fetchAndPlayReply(messages, 'help_spanish');
  };

  // Toggle Microphone
  const toggleListening = () => {
    if (!speechEngineRef.current) return;
    if (isListening) {
      speechEngineRef.current.stopListening();
      setIsListening(false);
    } else {
      speechEngineRef.current.startListening();
      setIsListening(true);
    }
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
              Práctica de Habla
            </span>
            <span className="text-sm font-bold text-gray-800">
              Nivel seleccionado: {level}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-gray-500 font-semibold">
            Velocidad: {Math.round(speedRate * 100)}%
          </span>
          <button
            onClick={() => {
              handleInterrupt();
              if (speechEngineRef.current) {
                speechEngineRef.current.destroy();
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
      <div className="bg-white border-4 border-[#FF6B6B] rounded-[32px] p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          {/* Main Visual Pulse Circle */}
          <div className="relative mb-4">
            <div
              className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
                isAssistantSpeaking
                  ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/40 scale-105'
                  : isListening
                  ? 'bg-[#6BCBCA] text-white shadow-lg shadow-[#6BCBCA]/40'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isAssistantSpeaking ? (
                <Volume2 className="w-14 h-14 sm:w-16 sm:h-16 animate-bounce" />
              ) : isListening ? (
                <Mic className="w-14 h-14 sm:w-16 sm:h-16 animate-pulse" />
              ) : (
                <MicOff className="w-14 h-14 sm:w-16 sm:h-16" />
              )}
            </div>

            {/* Pulsing ring animation */}
            {(isAssistantSpeaking || isListening) && (
              <div
                className={`absolute inset-0 rounded-full border-4 animate-ping opacity-30 ${
                  isAssistantSpeaking ? 'border-[#FF6B6B]' : 'border-[#6BCBCA]'
                }`}
              />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-800">Tutor de Inglés IA</h2>
          <p className="text-xs sm:text-sm text-[#FF6B6B] font-bold mt-0.5">
            {isAssistantSpeaking
              ? 'El tutor está hablando...'
              : isLoadingReply
              ? 'Generando respuesta...'
              : isListening
              ? 'Escuchando tu voz...'
              : 'Pausado'}
          </p>

          {/* Controls: Mute/Interrupt and Mic toggle */}
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={toggleListening}
              className={`p-4 rounded-2xl font-bold transition-all flex items-center gap-2 text-sm cursor-pointer shadow-sm ${
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
                className="p-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-2xl font-bold transition-all flex items-center gap-2 text-sm cursor-pointer animate-pulse"
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
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Patience prompt */}
      {silenceCounter > 8 && !isAssistantSpeaking && !isLoadingReply && (
        <div className="p-4 bg-amber-50 border-3 border-[#FFD93D] rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">El tutor espera con paciencia. ¿Quieres que repita o te ayude?</span>
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

      {/* Transcript Container with Vibrant Teal border */}
      <div className="bg-white border-4 border-[#6BCBCA] rounded-[32px] p-6 shadow-lg space-y-4 relative">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6BCBCA] flex items-center justify-between border-b border-gray-100 pb-2">
          <span>Transcripción de Conversación</span>
          <span className="text-gray-400 font-normal tracking-normal lowercase">en vivo</span>
        </div>

        <div
          ref={chatContainerRef}
          className="max-h-80 min-h-48 overflow-y-auto space-y-4 pr-2"
        >
          {messages.length === 0 && isLoadingReply && (
            <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#6BCBCA] animate-spin" />
              <span className="font-semibold">Iniciando conversación con el tutor...</span>
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
                  {isUser ? 'Tú (Estudiante)' : 'Tutor IA'}
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
                Escuchando...
              </span>
              <div className="p-4 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed bg-[#6BCBCA]/20 text-teal-900 border border-[#6BCBCA]/40 italic rounded-br-none">
                {currentUserDraft}...
              </div>
            </div>
          )}

          {isLoadingReply && messages.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[#6BCBCA] font-bold py-2">
              <span className="w-2 h-2 bg-[#6BCBCA] rounded-full animate-ping" />
              <span>Pensando respuesta...</span>
            </div>
          )}
        </div>

        {/* Quick Action Buttons Row */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={handleSlower}
            disabled={isLoadingReply}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Gauge className="w-4 h-4 text-amber-600" />
            <span>Más despacio</span>
          </button>

          <button
            onClick={handleRepeat}
            disabled={isLoadingReply}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-xs text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-[#FF6B6B]" />
            <span>Repetir</span>
          </button>

          {['A1', 'A2', 'B1'].includes(level) && (
            <button
              onClick={handleSpanishHelp}
              disabled={isLoadingReply}
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
              placeholder="Escribe un mensaje si no quieres usar micrófono..."
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#FF6B6B]"
            />
            <button
              onClick={() => handleUserSendMessage(textInput)}
              disabled={!textInput.trim() || isLoadingReply}
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
