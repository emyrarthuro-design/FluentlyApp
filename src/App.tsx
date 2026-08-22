import React, { useState } from 'react';
import { AppScreen, EnglishLevel, ChatMessage } from './types';
import { LevelSelector } from './components/LevelSelector';
import { ConversationView } from './components/ConversationView';
import { SummaryView } from './components/SummaryView';
import { Sparkles, MessageCircleCode } from 'lucide-react';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('level-select');
  const [selectedLevel, setSelectedLevel] = useState<EnglishLevel>('B1');
  const [sessionHistory, setSessionHistory] = useState<ChatMessage[]>([]);

  const handleStartSession = () => {
    setSessionHistory([]);
    setScreen('conversation');
  };

  const handleEndSession = (history: ChatMessage[]) => {
    setSessionHistory(history);
    setScreen('summary');
  };

  const handleRestart = () => {
    setSessionHistory([]);
    setScreen('level-select');
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-gray-800 flex flex-col font-sans antialiased">
      {/* Top Navbar Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div
            onClick={handleRestart}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-10 h-10 bg-[#FF6B6B] rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-red-500/20">
              F
            </div>
            <div>
              <span className="font-extrabold text-lg text-gray-800 tracking-tight block leading-none">
                Fluently App
              </span>
              <span className="text-[11px] text-gray-500 font-semibold">
                Práctica de Inglés Hablado por Voz
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 border-2 border-[#FFD93D] text-amber-900 text-xs font-bold rounded-full shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B6B]" />
              Prototipo de Voz IA
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {screen === 'level-select' && (
          <LevelSelector
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            onStartSession={handleStartSession}
          />
        )}

        {screen === 'conversation' && (
          <ConversationView
            level={selectedLevel}
            onEndSession={handleEndSession}
          />
        )}

        {screen === 'summary' && (
          <SummaryView
            level={selectedLevel}
            messages={sessionHistory}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SysTeam English Mentor Voice Prototype</span>
          <span className="text-slate-400 text-[11px]">
            Sin registro ni almacenamiento permanente • Impulsado por Gemini 3.6
          </span>
        </div>
      </footer>
    </div>
  );
}
