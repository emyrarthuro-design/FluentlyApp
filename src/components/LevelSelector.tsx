import React from 'react';
import { EnglishLevel, LevelOption } from '../types';
import { Sparkles, Mic, Volume2, ShieldCheck, ArrowRight, BookOpen } from 'lucide-react';

interface LevelSelectorProps {
  selectedLevel: EnglishLevel;
  onSelectLevel: (level: EnglishLevel) => void;
  onStartSession: () => void;
}

export const LEVEL_OPTIONS: LevelOption[] = [
  {
    code: 'A1',
    title: 'A1 - Principiante',
    description: 'Frases simples y vocabulario básico cotidiano.',
    speedLabel: 'Ritmo pausado, oraciones cortas y apoyo en español si te trabas.',
    languageMode: 'es-supported',
  },
  {
    code: 'A2',
    title: 'A2 - Elemental',
    description: 'Conversaciones breves sobre tu día a día.',
    speedLabel: 'Ritmo suave, vocabulario claro y soporte en español disponible.',
    languageMode: 'es-supported',
  },
  {
    code: 'B1',
    title: 'B1 - Intermedio',
    description: 'Temas cotidianos, trabajo y experiencias personales.',
    speedLabel: 'Ritmo moderado, expresiones naturales y explicaciones claras.',
    languageMode: 'es-supported',
  },
  {
    code: 'B2',
    title: 'B2 - Intermedio Alto',
    description: 'Fluidez buena para expresarte con seguridad.',
    speedLabel: 'Ritmo natural en inglés, excelente para ganar fluidez.',
    languageMode: 'en-only',
  },
  {
    code: 'C1',
    title: 'C1 - Avanzado',
    description: 'Vocabulario rico y conversación fluida sobre varios temas.',
    speedLabel: 'Ritmo nativo, vocabulario variado y giros idiomáticos.',
    languageMode: 'en-only',
  },
  {
    code: 'C2',
    title: 'C2 - Maestría',
    description: 'Dominio completo equivalente a un hablante nativo.',
    speedLabel: 'Conversación totalmente natural, rápida y compleja.',
    languageMode: 'en-only',
  },
];

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  selectedLevel,
  onSelectLevel,
  onStartSession,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header Banner with Vibrant Palette styling */}
      <div className="bg-white border-4 border-[#FFD93D] rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-50 rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-50 rounded-full pointer-events-none" />

        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-full text-[#FF6B6B] text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B6B]" /> Conversación de Voz en Tiempo Real
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight">
            Práctica de Inglés por Voz con Tutor IA
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed font-medium">
            Habla naturalmente con tu tutor virtual paciente y motivador. Elige tu nivel y practica conversación en tiempo real sin presiones ni interrupciones de corrección.
          </p>
        </div>
      </div>

      {/* Level Selection Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#FF6B6B]" />
              Selecciona tu nivel de inglés
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              El asistente adaptará la velocidad de voz y la complejidad de sus oraciones.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LEVEL_OPTIONS.map((level) => {
            const isSelected = selectedLevel === level.code;
            return (
              <button
                key={level.code}
                onClick={() => onSelectLevel(level.code)}
                className={`text-left p-5 rounded-3xl transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-4 border-[#FF6B6B] bg-red-50/40 shadow-lg scale-[1.02]'
                    : 'border-4 border-gray-100 bg-white hover:border-[#6BCBCA] hover:bg-teal-50/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                        isSelected
                          ? 'bg-[#FF6B6B] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Nivel {level.code}
                    </span>
                    {level.languageMode === 'es-supported' && (
                      <span className="text-[10px] text-teal-800 bg-teal-50 border border-[#6BCBCA] px-2.5 py-0.5 rounded-full font-bold">
                        Soporte en español
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">{level.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">{level.description}</p>
                </div>
                <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-4 h-4 text-[#FF6B6B] shrink-0" />
                  <span>{level.speedLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="bg-white border-4 border-gray-100 p-6 rounded-[32px] grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-gray-600 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#6BCBCA]/20 text-teal-700 rounded-2xl flex items-center justify-center shrink-0 font-bold">
            <Mic className="w-5 h-5 text-[#6BCBCA]" />
          </div>
          <div>
            <span className="font-bold text-gray-800 block text-sm mb-0.5">Interrupción Fluida</span>
            Puedes interrumpir al asistente en cualquier momento hablando o tocando la pantalla.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shrink-0 font-bold">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <span className="font-bold text-gray-800 block text-sm mb-0.5">Sin Correcciones Bruscas</span>
            Habla libremente con errores. La prioridad es ganar confianza y soltura al hablar.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-pink-100 text-[#FF6B6B] rounded-2xl flex items-center justify-center shrink-0 font-bold">
            <Sparkles className="w-5 h-5 text-[#FF6B6B]" />
          </div>
          <div>
            <span className="font-bold text-gray-800 block text-sm mb-0.5">Resumen Final</span>
            Al terminar la sesión, recibirás 3 puntos clave: tus aciertos, qué mejorar y tu consejo práctico.
          </div>
        </div>
      </div>

      {/* Start Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <p className="text-xs text-gray-500 text-center sm:text-left font-medium">
          El tema de la conversación será una presentación sencilla y charla sobre tu día.
        </p>
        <button
          onClick={onStartSession}
          className="w-full sm:w-auto px-10 py-4 bg-[#FF6B6B] hover:bg-red-500 text-white font-extrabold rounded-3xl shadow-lg shadow-red-500/25 transform active:scale-95 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          <span>Empezar Conversación ({selectedLevel})</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
