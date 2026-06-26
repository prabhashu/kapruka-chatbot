import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'user', parts: [{ text: 'Hi' }] }
      ]
    });
    console.log("Success:", res.text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
