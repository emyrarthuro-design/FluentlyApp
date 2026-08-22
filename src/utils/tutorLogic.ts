import { EnglishLevel, ChatMessage, SessionSummary } from '../types';

interface GenerateReplyOptions {
  level: EnglishLevel;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  action?: 'repeat' | 'slow_down' | 'help_spanish';
}

export function generateTutorGreeting(level: EnglishLevel): string {
  switch (level) {
    case 'A1':
      return "Hello! I am your English tutor. Welcome! How are you today?";
    case 'A2':
      return "Hi there! Welcome to our English session. How is your day going so far?";
    case 'B1':
      return "Hello! Great to have you here today. Could you introduce yourself and tell me a bit about your day?";
    case 'B2':
      return "Hello! Welcome to our conversation session. Let's do some light small talk—how has your day been treating you?";
    case 'C1':
      return "Hi! Glad you could join today. Let's catch up—how's your week unfolding, and what have you been up to?";
    case 'C2':
      return "Welcome! Wonderful to connect with you. How's everything going with you today?";
    default:
      return "Hello! Welcome to our English practice. How are you doing today?";
  }
}

export function generateSmartTutorReply(options: GenerateReplyOptions): string {
  const { level, messages, action } = options;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')?.text || '';

  // Handle specific user action buttons
  if (action === 'repeat' || /repeat|say again|puedes repetir/i.test(lastUserMsg)) {
    if (lastAssistantMsg) {
      if (level === 'A1' || level === 'A2') {
        return `Sure! I said: "${lastAssistantMsg}"`;
      }
      return `Of course! I was saying: "${lastAssistantMsg}"`;
    }
    return "Sure! I was asking how your day is going.";
  }

  if (action === 'slow_down' || /slower|más despacio|mas despacio|habla despacio/i.test(lastUserMsg)) {
    if (level === 'A1' || level === 'A2') {
      return "No problem. I will speak slowly. How are you today?";
    }
    return "Certainly! I will slow down for you. What did you do earlier today?";
  }

  if (action === 'help_spanish' || /ayuda|español|spanish|no entiendo|que significa/i.test(lastUserMsg)) {
    if (level === 'A1' || level === 'A2') {
      return "¡Claro! Te preguntaba cómo estás y cómo estuvo tu día. ¿Qué hiciste hoy?";
    }
    return "¡Con gusto! Estábamos conversando sobre tu día y tus actividades cotidianas. Cuéntame qué hiciste hoy en inglés.";
  }

  const lower = lastUserMsg.toLowerCase().trim();

  // If no user messages yet or starting
  if (!lower) {
    return generateTutorGreeting(level);
  }

  // Greetings & basic responses
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|hola)/i.test(lower)) {
    if (level === 'A1') {
      return "Hello! Nice to meet you. Are you happy today?";
    }
    if (level === 'A2') {
      return "Hello! It's great to meet you. What did you do this morning?";
    }
    return "Hi there! Great to meet you. What kind of activities have kept you busy today?";
  }

  // How are you / feelings
  if (/good|fine|great|well|tired|busy|bien|happy|ok|okay|not bad|exhausted/i.test(lower)) {
    if (/tired|exhausted|busy|hard/i.test(lower)) {
      if (level === 'A1' || level === 'A2') {
        return "I understand. Rest is important! Did you work or study today?";
      }
      return "Sounds like you had a very demanding day! Did work or study keep you on your toes?";
    }
    if (level === 'A1') {
      return "That is wonderful! Do you like to watch movies or listen to music?";
    }
    if (level === 'A2') {
      return "I'm glad to hear that! What do you like to do in your free time?";
    }
    return "That's fantastic to hear. What do you typically enjoy doing when you want to unwind after a busy day?";
  }

  // Work / Study / Job
  if (/work|study|job|university|college|school|office|engineer|teacher|student|doctor|lawyer|developer|programmer/i.test(lower)) {
    if (level === 'A1' || level === 'A2') {
      return "That is very interesting! Do you enjoy your work or studies?";
    }
    if (level === 'B1' || level === 'B2') {
      return "That sounds very interesting. What is your favorite part about what you do?";
    }
    return "That sounds intriguing. What projects or responsibilities have been taking up most of your focus lately?";
  }

  // Hobbies, Music, Movies, Sports
  if (/music|movie|film|series|game|play|sport|soccer|football|gym|read|book|guitar|food|cook|eat/i.test(lower)) {
    if (level === 'A1' || level === 'A2') {
      return "That is awesome! Who is your favorite artist or what is your favorite movie?";
    }
    if (level === 'B1' || level === 'B2') {
      return "That sounds really fun. How often do you get to enjoy doing that?";
    }
    return "That's a great passion to have. What drew you into that in the first place?";
  }

  // Weather or Place / City
  if (/weather|sunny|rain|cold|hot|city|mexico|colombia|spain|argentina|peru|chile|live|country/i.test(lower)) {
    if (level === 'A1' || level === 'A2') {
      return "Nice! What is your favorite place in your city?";
    }
    return "That's very cool. What's the atmosphere like there during this time of year?";
  }

  // Family, Pets, Friends
  if (/family|dog|cat|pet|friend|brother|sister|mom|dad|wife|husband|son|daughter/i.test(lower)) {
    if (level === 'A1' || level === 'A2') {
      return "That is lovely! Tell me more about them.";
    }
    return "That's wonderful to hear. How do you usually like to spend time together?";
  }

  // General conversational continuity by level
  const a1FollowUps = [
    "That is nice! Do you like coffee or tea?",
    "Very good! What is your favorite color or food?",
    "Awesome! What time do you wake up in the morning?",
    "Great! Do you have any pets, like a dog or cat?",
    "Interesting! What do you like to do on weekends?",
  ];

  const intermediateFollowUps = [
    "That makes a lot of sense. What other plans do you have for the rest of today?",
    "I see! What's something interesting that happened to you this week?",
    "That sounds nice. If you could travel anywhere this weekend, where would you go?",
    "That's great! How long have you been practicing your English?",
    "Interesting perspective! How do you usually spend your Saturday afternoons?",
  ];

  const advancedFollowUps = [
    "That's a fascinating point. How do you see that evolving in the near future?",
    "That's quite an interesting experience. What was the most memorable takeaway from that?",
    "I appreciate you sharing that. What inspired that particular approach?",
    "That sounds like a worthwhile endeavor. How has that shaped your daily routine?",
  ];

  const pool =
    level === 'A1' || level === 'A2'
      ? a1FollowUps
      : level === 'B1' || level === 'B2'
      ? intermediateFollowUps
      : advancedFollowUps;

  const randomFollowUp = pool[Math.floor(Math.random() * pool.length)];

  if (level === 'A1') {
    return `Great! ${randomFollowUp}`;
  }
  if (level === 'A2') {
    return `That sounds good! ${randomFollowUp}`;
  }
  return `That's very interesting. ${randomFollowUp}`;
}

export function generateSmartSessionSummary(
  messages: Array<{ role: string; text: string }>,
  level: EnglishLevel
): SessionSummary {
  const userMessages = messages.filter((m) => m.role === 'user');
  const userWordCount = userMessages.reduce((acc, m) => acc + m.text.split(/\s+/).length, 0);

  const isSpanish = ['A1', 'A2', 'B1'].includes(level);

  if (isSpanish) {
    let strengths: string[] = [];
    if (userMessages.length >= 3) {
      strengths.push('Excelente iniciativa para responder con naturalidad y mantener el hilo de la conversación.');
      strengths.push('Buen uso de vocabulario cotidiano para presentarte y hablar de tus actividades.');
    } else {
      strengths.push('Buena disposición y entusiasmo al iniciar la práctica conversacional en inglés.');
    }

    let improvements: string[] = [];
    if (userWordCount < 20) {
      improvements.push('Intenta elaborar oraciones un poco más largas utilizando conectores como "and", "because" o "also".');
    } else {
      improvements.push('Continúa practicando la fluidez verbal sin preocuparte por pausas o pequeños detalles gramaticales.');
    }

    const recommendation =
      level === 'A1' || level === 'A2'
        ? 'En tu próxima sesión, intenta describir 2 actividades que hiciste durante el día usando oraciones simples.'
        : 'Para la siguiente práctica, intenta explicar "por qué" te gusta una actividad usando "because" y añadiendo un ejemplo.';

    return {
      strengths,
      improvements,
      recommendation,
    };
  } else {
    let strengths: string[] = [
      'Great engagement and natural responses throughout the small-talk session.',
      'Clear pronunciation intent and willingness to express personal thoughts comfortably.',
    ];

    let improvements: string[] = [
      'Focus on connecting ideas using transition phrases such as "furthermore", "on the other hand", or "for instance".',
    ];

    let recommendation =
      'In your next conversation, challenge yourself to elaborate with mini-stories or anecdotes to practice varied past and future verb tenses.';

    return {
      strengths,
      improvements,
      recommendation,
    };
  }
}
