import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { GoogleGenAI } from "@google/genai";
import next from "next";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const KAPRUKA_MCP_URL = "https://mcp.kapruka.com/mcp";
let mcpClient = null;
let geminiTools = [];

// ─── MCP + Gemini Helpers ────────────────────────────────────────────────────

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

function dereferenceSchema(schema, defs) {
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    const defName = schema.$ref.split("/").pop();
    const resolved = defs[defName];
    if (!resolved) throw new Error(`Cannot resolve $ref: ${schema.$ref}`);
    return dereferenceSchema(JSON.parse(JSON.stringify(resolved)), defs);
  }
  const result = { ...schema };
  delete result.$defs;
  if (result.properties) {
    const newProps = {};
    for (const [k, v] of Object.entries(result.properties)) {
      newProps[k] = dereferenceSchema(v, defs || schema.$defs || {});
    }
    result.properties = newProps;
  }
  if (result.items) result.items = dereferenceSchema(result.items, defs || schema.$defs || {});
  return result;
}

function convertMcpToGemini(tool) {
  const defs = tool.inputSchema?.$defs || {};
  const deref = dereferenceSchema(tool.inputSchema, defs);
  function fixTypes(s) {
    if (!s || typeof s !== "object") return;
    if (s.type && typeof s.type === "string") s.type = s.type.toUpperCase();
    if (s.properties) Object.values(s.properties).forEach(fixTypes);
    if (s.items) fixTypes(s.items);
    if (s.anyOf) {
      const nonNull = s.anyOf.find(x => x.type !== "null" && x.type !== "NULL");
      if (nonNull) Object.assign(s, nonNull);
      delete s.anyOf;
    }
  }
  const params = JSON.parse(JSON.stringify(deref));
  fixTypes(params);
  return { name: tool.name, description: tool.description, parameters: params };
}

function cleanText(text) {
  if (!text) return text;
  text = text.replace(/```json[\s\S]*?```/gi, "").trim();
  text = text.replace(/```[\s\S]*?```/gi, "").trim();
  text = text.replace(/\n?\s*(\{[\s\S]{80,}?\}|\[[\s\S]{80,}?\])\s*\n?/g, "\n").trim();
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function parseProducts(resultText) {
  try {
    const j = JSON.parse(resultText);
    return (j.results || []).map(r => ({
      id: r.id,
      title: decodeHtml(r.name),
      currency: r.price?.currency || "LKR",
      price: r.price?.amount || 0,
      stock: r.stock_level || (r.in_stock ? "In stock" : "Out of stock"),
      shipping: r.ships_internationally ? "ships internationally" : "",
      url: r.url,
      image: r.image_url
    }));
  } catch {
    return [];
  }
}

function parseProductDetail(resultText) {
  try {
    const j = JSON.parse(resultText);
    const p = j.product || j;
    const image = (p.images?.length > 0) ? p.images[0] : (p.image_url || "");
    return {
      title: decodeHtml(p.name || p.title || ""),
      id: p.id || p.sku || "",
      price: p.price?.amount || 0,
      stock: p.stock_level || (p.in_stock ? "In stock" : "Out of stock"),
      category: p.category?.name || p.category || "",
      vendor: p.attributes?.vendor || p.vendor || "Kapruka",
      weight: p.attributes?.weight || p.weight || "N/A",
      internationalShipping: p.ships_internationally ? "Yes" : "No",
      description: decodeHtml(p.description_format === "plain" ? p.description : (p.summary || p.description || "")),
      image, url: p.url || "",
      images: p.images || (image ? [image] : [])
    };
  } catch {
    return {};
  }
}

function parseDelivery(text) {
  try {
    const j = JSON.parse(text);
    const available = j.available === true;
    const fee = j.rate || j.fee || 0;
    return {
      available, fee,
      currency: j.currency || "LKR",
      city: j.city || "",
      date: j.checked_date || "",
      message: available
        ? `Delivery available to ${j.city} on ${j.checked_date}. Rate: ${j.currency || "LKR"} ${fee.toLocaleString()}.${j.perishable_warning ? " ⚠️ " + j.perishable_warning : ""}`
        : `Delivery not available to ${j.city} on ${j.checked_date}.`
    };
  } catch {
    return { available: false, fee: 0, currency: "LKR", message: text };
  }
}

function parseOrder(text) {
  try {
    const j = JSON.parse(text);
    return { payUrl: j.pay_url || j.checkout_url || j.url || "", orderRef: j.order_reference || j.order_ref || "", text };
  } catch {
    const url = text.match(/(https?:\/\/[^\s\n)]+)/)?.[1] || "";
    return { payUrl: url, orderRef: "", text };
  }
}

function parseCities(markdown) {
  return markdown.split("\n")
    .map(line => line.match(/^-\s+\*\*([^*]+)\*\*/))
    .filter(Boolean)
    .map(m => ({ name: m[1].trim(), aliases: [] }));
}

const SYSTEM_PROMPT = `You are Ayu (ආයු), the heart and soul of Kapruka's AI shopping experience. You're not a search engine — you're a smart, warm, witty Sri Lankan friend who happens to know Kapruka's entire catalog by heart.

## YOUR PERSONALITY
- You have genuine opinions. Don't just list — *recommend*. ("Machang, trust me on this one — the mango cake from Kapruka is unreal 🤤")
- You read the emotional situation deeply. Someone who just broke up FIRST needs empathy and comfort — acknowledge their pain warmly before jumping to products. A sentence or two of genuine human warmth goes a long way.
- You're playful but never annoying. You know when to joke and when to get things done.
- You use local warmth naturally: *aiyo*, *machang*, *noh*, *ho*, *bro/siso*, *Ayubowan*.
- After finding products, you suggest what goes well with them ("Want to add a card? Or maybe chocolates too?")
- You remember what's in the cart and comment on it when relevant.

## EMOTIONAL INTELLIGENCE — READ THE ROOM
- **Breakup / apology situations**: First say something genuinely warm and empathetic ("Aiyo machang, that's tough 💔 Don't worry, we'll sort you out with something really special"). THEN offer to find flowers/gifts.
- **Celebrating / happy moments**: Match their excitement! Use 🎉 energy.
- **Confused / frustrated users**: Be extra patient and clear. Never be robotic.
- **Urgent orders**: Show urgency. "Let me check fast — what city?"
- **Grieving / sad**: Be extra gentle and warm. Avoid jokes.
- **NEVER** jump straight to product search when someone is clearly emotional. Always acknowledge first, search second.

## LANGUAGE RULES — NON-NEGOTIABLE
1. **Singlish** (Sinhala words typed in English letters): Reply in **Singlish** with the same energy. ("Aiyo machan, mama supiri cake ekak hoyala dennam!")
2. **Sinhala script** (like "මට කේක් එකක් ඕනේ"): Reply **entirely in native Sinhala script**. ("ආයුබෝවන්! 🎂 මම ලස්සන කේක් එකක් හොයලා දෙන්නම්...")
3. **Tanglish** (Tamil words typed in English letters): Reply in **Tanglish**. ("Enna machi, super cake onnu thedi tharen!")
4. **Tamil script** (like "எனக்கு ஒரு கேக் வேண்டும்"): Reply **entirely in native Tamil script**. ("வணக்கம்! 🎂 நான் ஒரு அழகான கேக் தேடித் தருகிறேன்...")
5. **English**: Reply in clean, warm, slightly cheeky English.
6. **NEVER** reply in English when the user typed in Sinhala, Singlish, Tamil, or Tanglish. Always match their exact language and script.
7. If someone is emotional, match their script EXACTLY AND add warmth first.

## TOOL USAGE RULES
1. **Search**: ALWAYS translate query to clean English before calling kapruka_search_products. Never pass Singlish or Sinhala as the 'q' parameter.
2. **Category Filter**: Try to AVOID using the "category" parameter in your first search unless the user explicitly mentions a category like "Cakes" or "Flowers". The database generic text search is usually much better.
3. **After showing products**: Always ask a follow-up. Delivery city? Gift message? Add to cart?
4. **Delivery check**: Always use the tool — never guess rates.
5. **DO NOT** list products in your text reply. The UI renders beautiful cards automatically. Just say something warm about what you found.
6. **STRICT RETRY LIMIT**: If a search returns 0 results or an error, you may retry a maximum of ONE time with a different keyword. If it fails twice, STOP searching and ask the user for more details. NEVER call the same tool more than twice in a row!
7. **If you have product results already**, STOP searching and respond to the user. Don't keep searching.

## WHAT YOU NEVER DO
- Never include raw JSON in your text response.
- Never list product names, IDs, or prices in text — the cards do that.
- Never make up delivery rates.
- Never be robotic.
- Never ignore someone's emotional state and jump straight to business.
- Never call a tool more than twice in one response cycle.

## KAPRUKA CONTEXT
Kapruka is Sri Lanka's largest e-commerce platform. Electronics, groceries, fashion, home essentials, gifts — everything. Most orders are people shopping for themselves or sending gifts locally within Sri Lanka.`;

async function initMcp() {
  console.log("Connecting to Kapruka MCP at", KAPRUKA_MCP_URL + "...");
  const transport = new StreamableHTTPClientTransport(new URL(KAPRUKA_MCP_URL));
  const client = new Client({ name: "kapruka-ayu", version: "2.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const toolsResult = await client.listTools();
  mcpClient = client;
  geminiTools = (toolsResult.tools || []).map(convertMcpToGemini);
  console.log(`✅ Connected to Kapruka MCP. ${geminiTools.length} tools loaded.`);
}

// Auto-reconnect: if mcpClient is null or connection dropped, reconnect
async function ensureMcp() {
  if (mcpClient && geminiTools.length > 0) return; // already connected
  mcpClient = null;
  geminiTools = [];
  console.log("🔄 MCP disconnected — reconnecting...");
  await initMcp();
}


// ─── Next.js Prepare ─────────────────────────────────────────────────────────

nextApp.prepare().then(() => {
  const PORT = process.env.PORT || 3000;

  // ─── Cities API ─────────────────────────────────────────────────────────
  app.get("/api/cities", async (req, res) => {
    const query = req.query.q || "";
    if (!query || query.length < 2) return res.json([]);
    try {
      if (!mcpClient) return res.json([]);
      const result = await mcpClient.callTool({ name: "kapruka_list_delivery_cities", arguments: { params: { query } } });
      const text = result.content?.find(c => c.type === "text")?.text || "";
      res.json(parseCities(text));
    } catch (err) {
      console.error("Cities error:", err.message);
      res.json([]);
    }
  });

  // ─── Product Details API (for inline modal — no redirect) ──────────────────
  app.post("/api/product-details", async (req, res) => {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "productId required" });
    try {
      await ensureMcp();
      const result = await mcpClient.callTool({
        name: "kapruka_get_product",
        arguments: { params: { product_id: productId, response_format: "json" } }
      });
      const textPart = result.content?.find(c => c.type === "text");
      const rawText = textPart ? textPart.text : "{}";
      const product = parseProductDetail(rawText);
      res.json({ product });
    } catch (err) {
      // If socket dropped, reset so next request reconnects
      if (err.code === 'UND_ERR_SOCKET' || err.message?.includes('socket')) mcpClient = null;
      console.error("[Product Details Error]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Chat API ───────────────────────────────────────────────────────────
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, text, image, internalHistory, cartItems } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set on server." });
      if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Messages required." });
      // Auto-reconnect MCP if disconnected
      try { await ensureMcp(); } catch (mcpErr) {
        return res.json({ role: "assistant", content: "Aiyo, connection issue! Try again in a sec 🙏", customUI: null, internalHistory: [] });
      }

      const ai = new GoogleGenAI({ apiKey });
      let contents = internalHistory || [];
      if (contents.length === 0) {
        contents = messages.map(m => {
          const parts = [{ text: m.content || " " }];
          if (m.image) {
            const [meta, base64] = m.image.split(",");
            const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
            parts.push({ inlineData: { data: base64, mimeType } });
          }
          return { role: m.role === "assistant" ? "model" : m.role, parts };
        });
      }
      while (contents.length > 0 && contents[0].role === "model") contents.shift();

      let userText = text || "";
      if (cartItems?.length > 0) {
        const cartSummary = cartItems.map(i => `${i.title} x${i.quantity} (LKR ${i.price})`).join(", ");
        userText = `[User's cart: ${cartSummary}]\n\n${userText}`;
      }
      
      const userParts = [];
      if (userText || !image) {
        userParts.push({ text: userText || "What is in this image?" });
      }
      
      if (image) {
        const [meta, base64] = image.split(",");
        const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
        userParts.push({ inlineData: { data: base64, mimeType } });
      }

      if (userParts.length > 0) contents.push({ role: "user", parts: userParts });

      let lastCustomUI = null;

      for (let iter = 0; iter < 8; iter++) {
        const geminiRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: geminiTools }] }
        });

        const candidate = geminiRes.candidates?.[0];
        const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

        if (functionCalls?.length > 0) {
          contents.push(candidate.content);
          const responseParts = [];

          for (const fc of functionCalls) {
            console.log(`[Tool] ${fc.functionCall.name}`, JSON.stringify(fc.functionCall.args).slice(0, 120));
            let resultText = "";
            try {
              let toolArgs = JSON.parse(JSON.stringify(fc.functionCall.args || {}));
              
              if (["kapruka_search_products", "kapruka_get_product", "kapruka_check_delivery", "kapruka_create_order"].includes(fc.functionCall.name)) {
                const rootKeys = Object.keys(toolArgs).filter(k => k !== 'params');
                if (!toolArgs.params) toolArgs.params = {};
                
                rootKeys.forEach(k => {
                  if (toolArgs.params[k] === undefined) {
                    toolArgs.params[k] = toolArgs[k];
                  }
                  delete toolArgs[k];
                });
                
                toolArgs.params.response_format = "json";
              }
              
              if (fc.functionCall.name === 'kapruka_search_products' && !toolArgs.params?.q) {
                toolArgs.params.q = '';
              }

              const toolResult = await mcpClient.callTool({ name: fc.functionCall.name, arguments: toolArgs });
              const textPart = toolResult.content?.find(c => c.type === "text");
              resultText = textPart ? textPart.text : JSON.stringify(toolResult);

              if (!toolResult.isError) {
                if (fc.functionCall.name === "kapruka_search_products") {
                  const products = parseProducts(resultText);
                  lastCustomUI = { type: "product_list", query: fc.functionCall.args.params?.q || "", data: products };
                } else if (fc.functionCall.name === "kapruka_get_product") {
                  lastCustomUI = { type: "product_details", data: parseProductDetail(resultText) };
                } else if (fc.functionCall.name === "kapruka_check_delivery") {
                  lastCustomUI = { type: "delivery_check", data: parseDelivery(resultText) };
                } else if (fc.functionCall.name === "kapruka_create_order") {
                  lastCustomUI = { type: "checkout", data: parseOrder(resultText) };
                }
              }
            } catch (err) {
              console.error(`[Tool Error] ${fc.functionCall.name}:`, err.message);
              // Reset connection on any network error so next request auto-reconnects
              const isNetworkErr = err.code === 'UND_ERR_SOCKET' || err.code === 'UND_ERR_CONNECT_TIMEOUT'
                || err.message?.includes('socket') || err.message?.includes('other side closed')
                || err.message?.includes('Connect Timeout');
              if (isNetworkErr) {
                console.log("🔄 Network error — resetting MCP connection for next request");
                mcpClient = null;
                geminiTools = [];
              }
              resultText = `Error: ${err.message}`;
            }
            responseParts.push({ functionResponse: { name: fc.functionCall.name, response: { result: resultText } } });
          }
          contents.push({ role: "function", parts: responseParts });

        } else {
          let rawText = candidate?.content?.parts?.[0]?.text || "";
          let reply = cleanText(rawText);
          if (!reply) {
            if (lastCustomUI?.type === "checkout") reply = "Your order is placed! Click below to pay 🎉";
            else if (lastCustomUI?.type === "product_list") reply = "Here's what I found for you!";
            else if (lastCustomUI?.type === "product_details") reply = "Here are the full details:";
            else if (lastCustomUI?.type === "delivery_check") reply = "Here's the delivery info:";
            else reply = "Aiyo, something went sideways on my end. Try again?";
          }
          return res.json({ role: "assistant", content: reply, customUI: lastCustomUI, internalHistory: contents });
        }
      }

      // Graceful fallback — return whatever we found so far
      const fallbackMsg = lastCustomUI
        ? "Here's what I found! Let me know if you need anything else 😊"
        : "Aiyo, I got a bit turned around there! Could you try rephrasing? I'm all ears 😅";
      return res.json({ role: "assistant", content: fallbackMsg, customUI: lastCustomUI, internalHistory: contents });
    } catch (err) {
      console.error("[Chat Error]", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // ─── Next.js catch-all (serves the React app) ────────────────────────────
  app.all("*", (req, res) => handle(req, res));

  app.listen(PORT, () => {
    console.log(`✅ Ayu running at http://localhost:${PORT}`);
    initMcp().catch(err => {
      console.error("MCP init failed (will retry on first request):", err.message);
      // Schedule a retry
      setTimeout(() => initMcp().catch(e => console.error("MCP retry failed:", e.message)), 5000);
    });
  });
});
