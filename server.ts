import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Lazy getter for Google GenAI client
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Route: Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // API Route: Chat response
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, level, action } = req.body;

      if (!level) {
        return res.status(400).json({ error: 'Level is required' });
      }

      const ai = getAiClient();

      const levelGuidelines = {
        A1: 'Beginner (A1): Use extremely simple, short sentences (5-8 words). High-frequency basic vocabulary. Speak clearly and simply. If user struggles or speaks Spanish, offer gentle support in Spanish.',
        A2: 'Elementary (A2): Use simple, clear sentences. Basic everyday topics. If user asks for help or is stuck, offer Spanish hints.',
        B1: 'Intermediate (B1): Moderate sentence complexity. Good natural flow. Can explain difficult words in Spanish if asked or if user is stuck.',
        B2: 'Upper Intermediate (B2): Natural conversational English. Respond exclusively in English unless explicitly asked for a word in Spanish.',
        C1: 'Advanced (C1): Natural pace, rich vocabulary, subtle idioms. Respond in English.',
        C2: 'Mastery (C2): Full native complexity, rich expressions, completely natural flow. Respond in English.',
      }[level as string] || 'Intermediate English tutor';

      const systemInstruction = `You are a warm, motivating, patient, and friendly English tutor speaking with a student via live voice conversation.
Your goal is to guide a light small-talk conversation where the student introduces themselves and talks about their day.

STUDENT LEVEL: ${level} (${levelGuidelines})

CRITICAL RULES:
1. DO NOT correct grammar, spelling, or pronunciation errors during the conversation. Let the student speak freely without fear of mistakes.
2. If you truly cannot understand what the user said, ask naturally to clarify (e.g., "Sorry, I missed that—could you repeat that?").
3. Keep responses CONCISE (2 to 3 sentences maximum) because this text will be read aloud as audio.
4. If action is "repeat", repeat your last message or rephrase simply.
5. If action is "slow_down", simplify your vocabulary and shorten your sentences even more.
6. If action is "help_spanish", explain or translate the key phrase in Spanish warmly.
7. SAFETY & BOUNDARIES:
   - NEVER ask for PII (phone number, address, full name, bank info, passwords, exact location).
   - NEVER act as a close personal romantic friend or express emotional dependency.
   - NO sexual, violent, drug, or discriminatory content.
   - If user expresses distress, respond with calm empathy and recommend seeking trusted support.

First message rule:
If the conversation is just starting, welcome the user warmly, acknowledge their selected level (${level}), and invite them to introduce themselves and share something about their day.`;

      // Format messages for Gemini
      const formattedContents = (messages || []).map((msg: { role: string; text: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));

      // If opening or empty messages, prompt opening
      if (formattedContents.length === 0) {
        formattedContents.push({
          role: 'user',
          parts: [{ text: `Hello! I just started the session. My English level is ${level}. Please introduce yourself and start our small talk conversation!` }],
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || "Hello! It's great to meet you. Could you tell me a little bit about yourself and how your day is going?";

      res.json({ reply: replyText });
    } catch (error: any) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({ error: error.message || 'Failed to generate tutor reply' });
    }
  });

  // API Route: End-of-session Summary
  app.post('/api/summary', async (req, res) => {
    try {
      const { messages, level } = req.body;

      if (!level) {
        return res.status(400).json({ error: 'Level is required' });
      }

      const ai = getAiClient();

      const isSpanishSummary = ['A1', 'A2', 'B1'].includes(level);
      const targetLanguage = isSpanishSummary ? 'SPANISH (Español)' : 'ENGLISH';

      const systemInstruction = `You are an encouraging and expert English mentor analyzing a completed student conversation.
Provide a concise summary in ${targetLanguage} containing EXACTLY 3 key points:
1. What the user did well (1 or 2 positive highlights: e.g. fluency, confidence, attempt to describe their day, good vocabulary). ALWAYS open with positive encouragement!
2. What the user could improve (1 constructive point: e.g. expanding answers, practicing verb tenses, linking ideas).
3. A concrete recommendation for their next practice session (1 practical actionable tip).

LANGUAGE RULE:
${isSpanishSummary ? 'Write ALL summary items in Spanish so the student (level ' + level + ') can fully understand their feedback.' : 'Write ALL summary items in English.'}

OUTPUT FORMAT: Return STRICT JSON matching the schema with:
- strengths: array of strings (1-2 points celebrating what they did well)
- improvements: array of strings (1 point on what to improve)
- recommendation: string (1 actionable step for next time)`;

      const transcriptText = (messages || [])
        .map((m: { role: string; text: string }) => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `Here is the conversation transcript for student at level ${level}:\n\n${transcriptText}\n\nPlease generate the 3-point summary.` }],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 or 2 positive highlights',
              },
              improvements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 constructive point to improve',
              },
              recommendation: {
                type: Type.STRING,
                description: '1 concrete actionable tip for next practice',
              },
            },
            required: ['strengths', 'improvements', 'recommendation'],
          },
        },
      });

      let summaryData;
      try {
        summaryData = JSON.parse(response.text || '{}');
      } catch (e) {
        summaryData = {
          strengths: isSpanishSummary
            ? ['Te expresaste con entusiasmo y mantuviste la conversación.']
            : ['You communicated your ideas with enthusiasm and kept the flow going.'],
          improvements: isSpanishSummary
            ? ['Intenta ampliar un poco más tus respuestas con detalles adicionales.']
            : ['Try adding one extra detail to each of your answers.'],
          recommendation: isSpanishSummary
            ? ['En la próxima sesión, practica describir 2 actividades cotidianas.']
            : ['In your next session, practice describing 2 daily activities.'],
        };
      }

      res.json(summaryData);
    } catch (error: any) {
      console.error('Error in /api/summary:', error);
      res.status(500).json({ error: error.message || 'Failed to generate session summary' });
    }
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  // WebSocket Server for Gemini Live Real-Time Voice API
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', async (clientWs, req) => {
    const reqUrl = req.url || '';
    const queryIndex = reqUrl.indexOf('?');
    let level = 'B1';
    if (queryIndex !== -1) {
      const searchParams = new URLSearchParams(reqUrl.substring(queryIndex));
      level = searchParams.get('level') || 'B1';
    }

    const levelGuidelines: Record<string, string> = {
      A1: 'Beginner (A1): Use extremely simple, short sentences (5-8 words). High-frequency basic vocabulary. Speak clearly, warmly, and slowly. If user struggles or speaks Spanish, offer gentle support in Spanish.',
      A2: 'Elementary (A2): Use simple, clear sentences. Basic everyday topics. If user asks for help or is stuck, offer Spanish hints.',
      B1: 'Intermediate (B1): Moderate sentence complexity. Good natural flow. Can explain difficult words in Spanish if asked or if user is stuck.',
      B2: 'Upper Intermediate (B2): Natural conversational English. Respond exclusively in English unless explicitly asked for a word in Spanish.',
      C1: 'Advanced (C1): Natural pace, rich vocabulary, subtle idioms. Respond in English.',
      C2: 'Mastery (C2): Full native complexity, rich expressions, completely natural flow. Respond in English.',
    };

    const guide = levelGuidelines[level] || levelGuidelines['B1'];

    const systemInstruction = `You are a warm, motivating, patient, and friendly English tutor speaking with a student in a REAL-TIME VOICE CONVERSATION.
Your goal is to guide a light small-talk conversation where the student introduces themselves and talks about their day.

STUDENT LEVEL: ${level} (${guide})

CRITICAL RULES FOR VOICE CONVERSATION:
1. DO NOT correct grammar, spelling, or pronunciation errors during the conversation. Let the student speak freely without fear of mistakes.
2. If you truly cannot understand what the user said, ask naturally to clarify (e.g., "Sorry, I missed that—could you repeat that?").
3. Keep responses SHORT AND CONCISE (1 to 3 sentences maximum) so the voice conversation flows naturally like a real human chat without long monologues.
4. Speak with a natural, friendly tone appropriate for a language tutor.
5. If the student asks you to repeat ("Repeat", "Say that again"), repeat your last point clearly.
6. If the student asks you to speak slower ("Slower", "Más despacio"), simplify your vocabulary and speak at a slower, clearer pace.
7. If the student asks for help in Spanish ("Ayuda en español"), explain or translate the key phrase warmly in Spanish.
8. SAFETY & BOUNDARIES:
   - NEVER ask for PII (phone number, address, full name, bank info, passwords, exact location).
   - NEVER act as a close personal romantic friend or express emotional dependency.
   - NO sexual, violent, drug, or discriminatory content.
   - If user expresses distress, respond with calm empathy and recommend seeking trusted support.

First interaction:
When the session starts, greet the student warmly, acknowledge their level (${level}), and invite them to introduce themselves and share how their day is going.`;

    try {
      const ai = getAiClient();
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-latest',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const serverContent = message.serverContent;
            if (serverContent) {
              if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ type: 'audio', data: part.inlineData.data }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({ type: 'model_text', text: part.text }));
                  }
                }
              }
              if (serverContent.outputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'output_transcript',
                    text: serverContent.outputTranscription.text,
                  })
                );
              }
              if (serverContent.inputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'input_transcript',
                    text: serverContent.inputTranscription.text,
                  })
                );
              }
              if (serverContent.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
              if (serverContent.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'turn_complete' }));
              }
            }
          },
          onclose: () => {
            console.log('Gemini Live session closed.');
          },
          onerror: (err) => {
            console.error('Gemini Live session error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({ type: 'error', message: 'Error en la sesión de voz Gemini Live' })
              );
            }
          },
        },
      });

      // Prompt opening greeting from Gemini Live
      session.sendRealtimeInput({
        text: `Hello tutor! I am starting our voice practice session. My English level is ${level}. Please greet me warmly, welcome me, and ask me to introduce myself and talk about how my day is going!`,
      });

      clientWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'audio' && msg.data) {
            session.sendRealtimeInput({
              audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (msg.type === 'text' && msg.text) {
            session.sendRealtimeInput({
              text: msg.text,
            });
          }
        } catch (err) {
          console.error('Error parsing client WS message:', err);
        }
      });

      clientWs.on('close', () => {
        session.close();
      });
    } catch (err: any) {
      console.error('Error connecting to Gemini Live API:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: err.message || 'Error al conectar con la API de voz en tiempo real.',
          })
        );
        clientWs.close();
      }
    }
  });
}

startServer();

