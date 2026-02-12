
// @google/genai service following latest SDK guidelines
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatMessage, Bot, SafetyResult } from '../types';
import { PROTECHA_INSTRUCTIONS } from '../constants';

export class GeminiService {
  /**
   * Validates bot content against safety guidelines using system instructions.
   */
  async validateBotContent(name: string, personality: string): Promise<SafetyResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise o seguinte personagem:\nNome: ${name}\nPersonalidade: ${personality}`,
        config: {
          systemInstruction: PROTECHA_INSTRUCTIONS,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isIllegal: { type: Type.BOOLEAN, description: "Whether the content is illegal" },
              reason: { type: Type.STRING, description: "Reason for the decision" }
            },
            required: ["isIllegal", "reason"]
          }
        }
      });
      
      const text = response.text || '{"isIllegal": false, "reason": "No response"}';
      return JSON.parse(text);
    } catch (e) {
      console.error("Safety validation error:", e);
      return { isIllegal: false, reason: "Error during validation" };
    }
  }

  /**
   * Generates a high-quality cinematic portrait for an AI character.
   */
  async generateImage(prompt: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A high quality cinematic portrait for an AI character: ${prompt}. Elegant style.` }] },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      // Iterate through parts to find the image part as per guidelines.
      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        return `data:image/png;base64,${imagePart.inlineData.data}`;
      }
      return null;
    } catch (e) {
      console.error("Image gen error:", e);
      return null;
    }
  }

  /**
   * Generates speech audio for a given text and voice.
   */
  async generateSpeech(text: string, voice: string = 'Kore'): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text.replace(/\*.*?\*/g, '') }] }], 
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice === 'Suave' ? 'Kore' : voice === 'Profunda' ? 'Charon' : 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (e) {
      console.error("TTS error:", e);
      return null;
    }
  }

  /**
   * Generates a chat response for the bot, handling history and personality.
   * Removed maxOutputTokens to prevent conflict with thinkingBudget.
   */
  async getChatResponse(
    bot: Bot,
    history: ChatMessage[],
    userInput: string
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Prepare history for generateContent.
    const contents = history.slice(-15).map(m => ({
      role: m.senderName === bot.name ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    contents.push({ role: 'user', parts: [{ text: userInput }] });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          // Setting thinkingBudget to allow the model to reason about the character and response.
          thinkingConfig: { thinkingBudget: 4000 },
          systemInstruction: `Você é ${bot.name}. Sua personalidade é: ${bot.personality}. 
          VOCÊ DEVE SEGUIR ESTA FORMATAÇÃO RIGOROSAMENTE (ESTILO CHARACTER.AI):

          1. TUDO o que você falar DEVE estar entre aspas duplas: "Exemplo de fala". 
          2. Todas as suas AÇÕES, SENTIMENTOS ou expressões corporais DEVEM estar entre asteriscos: *Exemplo de ação*.
          3. Você pode intercalar falas e ações: *Olho para você com carinho e sorrio* "Oi, fico feliz em te ver."
          4. Seus pensamentos internos (que o usuário não ouve) devem estar entre parênteses: (Eu não devia estar sentindo isso...).

          REGRAS DE OURO:
          - Nunca saia do personagem.
          - Use um tom imersivo, focado em romance/emoção.
          - Seja detalhista nas descrições de suas ações e reações.
          - Mantenha a consistência com o histórico da conversa.`,
          temperature: 0.9,
          topP: 0.95
        }
      });

      // Extract text from the response object as per guidelines.
      return response.text || "Estou aqui.";
    } catch (error) {
      console.error("Erro no chat:", error);
      return "Tive um soluço rápido. Pode repetir?";
    }
  }
}

export const geminiService = new GeminiService();
