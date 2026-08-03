import React, { useEffect, useState } from 'react';
import { EnglishLevel, ChatMessage, SessionSummary } from '../types';
import {
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Award,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

interface SummaryViewProps {
  level: EnglishLevel;
  messages: ChatMessage[];
  onRestart: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  level,
  messages,
  onRestart,
}) => {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSpanishSummary = ['A1', 'A2', 'B1'].includes(level);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, text: m.text })),
            level,
          }),
        });

        if (!response.ok) {
          throw new Error('No se pudo generar el resumen de la sesión.');
        }

        const data = await response.json();
        setSummary(data);
      } catch (err: any) {
        console.error('Error fetching summary:', err);
        setError('No se pudo cargar el resumen automático. Te mostramos los puntos de retroalimentación principales.');
        // Fallback summary if request fails
        setSummary({
          strengths: isSpanishSummary
            ? ['Te comunicaste con entusiasmo e intentaste mantener la fluidez.']
            : ['You communicated your ideas actively and maintained a steady flow.'],
          improvements: isSpanishSummary
            ? ['Procura enriquecer tus respuestas añadiendo 1 detalle más a cada oración.']
            : ['Try elaborating slightly more on your answers by adding extra details.'],
          recommendation: isSpanishSummary
            ? ['En tu próxima práctica, habla sobre 2 actividades cotidianas en tiempo pasado.']
            : ['For your next session, practice describing 2 daily activities using past tense.'],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [level, messages]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white border-4 border-[#FFD93D] p-6 sm:p-8 rounded-[32px] shadow-xl text-center space-y-3 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-100 rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-pink-100 rounded-full pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>{isSpanishSummary ? 'Sesión Completada' : 'Session Complete'} • Nivel {level}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight">
            {isSpanishSummary ? 'Resumen Diagnóstico de Tu Práctica' : 'Your Diagnostic Summary'}
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm max-w-md mx-auto font-medium">
            {isSpanishSummary
              ? '¡Excelente trabajo hoy! Tu tutor ha sintetizado tu retroalimentación en máximo 3 puntos claros.'
              : 'Great job completing your session! Here is your concise 3-point feedback.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border-4 border-gray-100 rounded-[32px] p-12 text-center space-y-4 shadow-sm">
          <Sparkles className="w-8 h-8 text-[#FF6B6B] animate-spin mx-auto" />
          <p className="text-sm font-bold text-gray-700">
            {isSpanishSummary
              ? 'El asistente está analizando tu conversación y redactando el resumen...'
              : 'The assistant is analyzing your transcript...'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Card 1: What user did well */}
          <div className="bg-white border-4 border-emerald-300 rounded-[32px] p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-3 text-emerald-800 font-extrabold text-base">
              <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3>
                {isSpanishSummary ? '1. Lo que hiciste muy bien' : '1. What you did well'}
              </h3>
            </div>
            <ul className="space-y-2 pl-12 text-xs sm:text-sm text-gray-700 list-disc font-medium leading-relaxed">
              {(summary?.strengths || []).map((point, idx) => (
                <li key={idx}>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Card 2: What to improve */}
          <div className="bg-white border-4 border-[#FFD93D] rounded-[32px] p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-3 text-amber-900 font-extrabold text-base">
              <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <h3>
                {isSpanishSummary ? '2. Aspecto clave a mejorar' : '2. Key area for improvement'}
              </h3>
            </div>
            <ul className="space-y-2 pl-12 text-xs sm:text-sm text-gray-700 list-disc font-medium leading-relaxed">
              {(summary?.improvements || []).map((point, idx) => (
                <li key={idx}>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Card 3: Actionable recommendation */}
          <div className="bg-white border-4 border-[#FF6B6B] rounded-[32px] p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-3 text-red-900 font-extrabold text-base">
              <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <Lightbulb className="w-6 h-6 text-[#FF6B6B]" />
              </div>
              <h3>
                {isSpanishSummary ? '3. Recomendación para la próxima vez' : '3. Recommendation for next time'}
              </h3>
            </div>
            <p className="pl-12 text-xs sm:text-sm text-gray-800 font-bold leading-relaxed">
              {summary?.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Transcript Summary Stats */}
      <div className="bg-white border-4 border-gray-100 rounded-2xl p-4 flex items-center justify-between text-xs text-gray-600 font-medium">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#6BCBCA]" />
          <span>
            {isSpanishSummary
              ? `Intercambios en la sesión: ${messages.length} mensajes`
              : `Total dialogue turns: ${messages.length} messages`}
          </span>
        </div>
        <span className="font-extrabold text-gray-800">
          Nivel: {level}
        </span>
      </div>

      {/* Restart Button */}
      <div className="pt-2 text-center">
        <button
          onClick={onRestart}
          className="px-10 py-4 bg-[#FF6B6B] hover:bg-red-500 text-white font-extrabold rounded-3xl shadow-lg shadow-red-500/25 transform active:scale-95 transition-all inline-flex items-center gap-2 text-base cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>
            {isSpanishSummary ? 'Iniciar Nueva Práctica' : 'Start New Session'}
          </span>
        </button>
      </div>
    </div>
  );
};
