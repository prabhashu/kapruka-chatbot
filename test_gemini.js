import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'model', parts: [{ text: 'Hello' }] },
        { role: 'user', parts: [{ text: 'Hi' }] },
        { role: 'model', parts: [{ text: 'How are you?' }] },
        { role: 'user', parts: [{ text: 'Good' }] }
      ]
    });
    console.log("Success:", res.text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
