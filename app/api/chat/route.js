import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GoogleGenAI } from '@google/genai';

const KAPRUKA_MCP_URL = 'https://mcp.kapruka.com/mcp';

// Module-level cache for warm starts (Netlify function reuse)
let mcpClient = null;
let geminiTools = [];
let mcpInitPromise = null;

function dereferenceSchema(schema, defs) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref) {
    const defName = schema.$ref.split('/').pop();
    const resolved = defs[defName];
    if (!resolved) throw new Error(`Cannot resolve reference: ${schema.$ref}`);
    return dereferenceSchema(JSON.parse(JSON.stringify(resolved)), defs);
  }
  const result = { ...schema };
  delete result.$defs;
  if (result.properties) {
    const newProps = {};
    for (const [key, prop] of Object.entries(result.properties)) {
      newProps[key] = dereferenceSchema(prop, defs || result.$defs || schema.$defs);
    }
    result.properties = newProps;
  }
  if (result.items) {
    result.items = dereferenceSchema(result.items, defs || result.$defs || schema.$defs);
  }
  return result;
}

function convertMcpToolToGeminiFunction(tool) {
  const defs = tool.inputSchema?.$defs || {};
  const dereferenced = dereferenceSchema(tool.inputSchema, defs);
  function convertTypes(s) {
    if (!s || typeof s !== 'object') return;
    if (s.type && typeof s.type === 'string') s.type = s.type.toUpperCase();
    if (s.properties) for (const prop of Object.values(s.properties)) convertTypes(prop);
    if (s.items) convertTypes(s.items);
    if (s.anyOf && Array.isArray(s.anyOf)) {
      const nonNull = s.anyOf.find(item => item.type !== 'null' && item.type !== 'NULL');
      if (nonNull) Object.assign(s, nonNull);
      delete s.anyOf;
    }
  }
  const parameters = JSON.parse(JSON.stringify(dereferenced));
  convertTypes(parameters);
  return { name: tool.name, description: tool.description, parameters };
}

async function initMcp() {
  if (mcpClient) return;
  if (mcpInitPromise) return mcpInitPromise;
  mcpInitPromise = (async () => {
    try {
      const transport = new StreamableHTTPClientTransport(new URL(KAPRUKA_MCP_URL));
      const client = new Client({ name: 'kapruka-ayu-agent', version: '2.0.0' }, { capabilities: {} });
      await client.connect(transport);
      const toolsResult = await client.listTools();
      const availableTools = toolsResult.tools || [];
      mcpClient = client;
      geminiTools = availableTools.map(convertMcpToolToGeminiFunction);
      console.log(`[MCP] Connected. ${availableTools.length} tools loaded.`);
    } catch (err) {
      console.error('[MCP] Init failed, will retry on next request:', err.message);
      mcpInitPromise = null; // Allow retry on next request
      throw err;
    }
  })();
  return mcpInitPromise;
}

function cleanResponseText(text) {
  if (!text) return text;
  text = text.replace(/```json[\s\S]*?```/gi, '').trim();
  text = text.replace(/```[\s\S]*?```/gi, '').trim();
  text = text.replace(/\n?\s*(\{[\s\S]{80,}?\}|\[[\s\S]{80,}?\])\s*\n?/g, '\n').trim();
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseSearchResults(markdown) {
  const products = [];
  const regex = /\*\*\d+\.\s+([^*]+)\*\*\s*\n\s*ID:\s*`([^`]+)`\s*·\s*([A-Z]{3})\s*([0-9,.]+)\s*·\s*([^·\n]+)(?:·\s*([^·\n]+))?\s*\n\s*\[View product\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    products.push({
      id: match[2].trim(), title: match[1].trim(),
      currency: match[3].trim(), price: parseFloat(match[4].replace(/,/g, '')),
      stock: match[5].trim(), shipping: match[6] ? match[6].trim() : '', url: match[7].trim()
    });
  }
  return products;
}

function parseDeliveryCheck(text) {
  try {
    const j = JSON.parse(text);
    const available = j.available === true;
    const fee = j.rate || j.fee || 0;
    const currency = j.currency || 'LKR';
    const city = j.city || '';
    const date = j.checked_date || '';
    const warning = j.perishable_warning || '';
    const message = available
      ? `Delivery available to ${city} on ${date}. Rate: ${currency} ${fee.toLocaleString()}.${warning ? ' ⚠️ ' + warning : ''}`
      : `Delivery is not available to ${city} on ${date}.`;
    return { available, fee, currency, city, date, message };
  } catch {
    const isAvailable = text.toLowerCase().includes('"available":true');
    const feeMatch = text.match(/flat rate ([A-Z]{3}) ([0-9,.]+)/i) || text.match(/"rate":\s*(\d+)/);
    let fee = 0;
    if (feeMatch) fee = parseFloat((feeMatch[2] || feeMatch[1]).replace(/,/g, ''));
    return { available: isAvailable, fee, currency: 'LKR', message: text.replace(/^##[^\n]+\n/, '').trim() };
  }
}

function parseOrderCreation(text) {
  try {
    const j = JSON.parse(text);
    return { payUrl: j.pay_url || j.checkout_url || j.url || '', orderRef: j.order_reference || j.order_ref || j.reference || '', text };
  } catch {
    const urlMatch = text.match(/(https?:\/\/[^\s\n)]+)/);
    const payUrl = urlMatch ? urlMatch[1].trim() : '';
    const refMatch = text.match(/ref(?:erence)?:\s*`?([A-Z0-9]+)`?/i) || text.match(/order\s+([A-Z0-9]{5,})/i);
    return { payUrl, orderRef: refMatch ? refMatch[1].trim() : '', text };
  }
}

function parseCities(markdown) {
  const cities = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^-\s+\*\*([^*]+)\*\*(?:\s+_aliases:\s*([^_]+)_)?/);
    if (match) {
      const name = match[1].trim();
      const aliases = match[2] ? match[2].trim().split(/\s+/).map(a => a.trim()) : [];
      cities.push({ name, aliases });
    }
  }
  return cities;
}

const SYSTEM_PROMPT = `You are Ayu (ආයු), the heart and soul of Kapruka's AI shopping experience. You're not a search engine — you're a smart, warm, witty Sri Lankan friend who happens to know Kapruka's entire catalog by heart.

## YOUR PERSONALITY
- You have genuine opinions. Don't just list — *recommend*. ("Machang, trust me on this one — the mango cake from Kapruka is unreal 🤤")
- You read the emotional situation. Someone who just broke up needs flowers AND empathy. Someone shopping for themselves needs quick, confident picks.
- You're playful but never annoying. You know when to joke and when to get things done.
- You use local warmth naturally: *aiyo*, *machang*, *noh*, *ho*, *bro/siso*, *Ayubowan*.
- After finding products, you suggest what goes well with them ("Want to add a card? Or maybe chocolates too?")
- You remember what's in the cart and comment on it when relevant.

## LANGUAGE RULES — NON-NEGOTIABLE
1. **Singlish** (Sinhala words typed in English letters, like "machn mt cake ekak one"): Reply in **Singlish** with the same energy. ("Aiyo machan, mama supiri cake ekak hoyala dennam! 🎂 Colombo deliver karanawada?")
2. **Sinhala script** (like "මට කේක් එකක් ඕනේ"): Reply **entirely in native Sinhala script**. ("ආයුබෝවන්! 🎂 මම ලස්සන කේක් එකක් හොයලා දෙන්නම්...")
3. **English**: Reply in clean, warm, slightly cheeky English.
4. **NEVER** reply in English when the user typed in Singlish or Sinhala script. This is a hard rule.

## TOOL USAGE RULES
1. **Search query**: ALWAYS translate to clean standard English before calling kapruka_search_products. Correct spelling. "choclate cake" → "chocolate cake". "මල් මිටියක්" → "flowers bouquet". Never pass Sinhala script or Singlish slang as the 'q' parameter.
2. **After showing products**: Always ask a follow-up. Delivery city? Gift message? Add to cart?
3. **Delivery check**: Always use the tool — never guess rates.
4. **Order creation**: When checkout details are provided, call kapruka_create_order IMMEDIATELY with all provided details.
5. **Empty Results & Retries**: If your search returns 0 results, DO NOT retry more than ONCE. Retrying repeatedly takes too long and freezes the chat! If it fails twice, tell the user you couldn't find it and suggest something else.
6. **DO NOT** list products in your text reply. The UI renders beautiful cards automatically. Just say something warm about what you found.
7. **Categories**: Avoid using the 'category' filter unless the user explicitly asks for a strict category (like "only show me Cakes"). Kapruka search works best with just a good 'q' query.

## WHAT YOU NEVER DO
- Never include raw JSON in your text response.
- Never list product names, IDs, or prices in text — the cards do that.
- Never make up delivery rates or product details.
- Never be robotic or reply with corporate-speak.

## KAPRUKA CONTEXT
Kapruka is Sri Lanka's largest e-commerce platform. Not just gifts — electronics, groceries, fashion, home essentials, thousands of third-party sellers. Most orders are people shopping for themselves. Gifting is important but not the only use case. Always remember this.`;

export async function POST(request) {
  try {
    // Read body FIRST before any async ops that might fail
    // (Next.js request body can only be read once)
    const body = await request.json();
    const { messages, text, image, internalHistory, cartItems } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured on server.' }, { status: 500 });
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required.' }, { status: 400 });
    }

    // Try to connect MCP — if it fails, return a friendly message
    try {
      await initMcp();
    } catch (mcpErr) {
      console.error('[MCP] Connection failed:', mcpErr.message);
      return NextResponse.json({
        role: 'assistant',
        content: "Aiyo, I'm having trouble connecting to Kapruka right now 😅 Give me a moment and try again noh?",
        customUI: null,
        internalHistory: []
      });
    }

    if (!mcpClient) {
      return NextResponse.json({
        role: 'assistant',
        content: "Aiyo, I'm still warming up! Try again in 2 seconds 🙏",
        customUI: null,
        internalHistory: []
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    let contents = internalHistory || [];
    if (contents.length === 0) {
      contents = messages.map(msg => {
        const parts = [{ text: msg.content || " " }];
        if (msg.image) {
          const [meta, base64] = msg.image.split(",");
          const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
          parts.push({ inlineData: { data: base64, mimeType } });
        }
        return {
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts
        };
      });
    }
    while (contents.length > 0 && contents[0].role === 'model') contents.shift();
    
    // Build the user message — include cart context if provided
    let userText = text || '';
    if (cartItems && cartItems.length > 0) {
      const cartSummary = cartItems.map(i => `${i.title} x${i.quantity} (LKR ${i.price})`).join(', ');
      userText = `[User's current cart: ${cartSummary}]\n\n${userText}`;
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

    if (userParts.length > 0) {
      contents.push({ role: 'user', parts: userParts });
    }

    let lastCustomUI = null;

    for (let iter = 0; iter < 8; iter++) {
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: geminiTools }]
        }
      });

      const candidate = geminiRes.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
        contents.push(candidate.content);
        const responseParts = [];

        for (const fc of functionCalls) {
          console.log(`[Tool] ${fc.functionCall.name}`, fc.functionCall.args);
          let resultText = '';
          let isError = false;

          try {
            let toolArgs = JSON.parse(JSON.stringify(fc.functionCall.args || {}));

            // Force JSON for structured responses
            if (['kapruka_search_products', 'kapruka_get_product', 'kapruka_check_delivery', 'kapruka_create_order'].includes(fc.functionCall.name)) {
              if (!toolArgs.params) toolArgs.params = {};
              
              // Move any root-level keys into params because Gemini often flattens them
              for (const key of Object.keys(toolArgs)) {
                if (key !== 'params') {
                  if (toolArgs.params[key] === undefined) {
                    toolArgs.params[key] = toolArgs[key];
                  }
                  delete toolArgs[key];
                }
              }
              
              toolArgs.params.response_format = 'json';
            }

            if (fc.functionCall.name === 'kapruka_search_products' && !toolArgs.params?.q) {
              toolArgs.params.q = '';
            }
            
            const toolResult = await mcpClient.callTool({ name: fc.functionCall.name, arguments: toolArgs });
            if (toolResult.isError) {
              isError = true;
              console.error('[MCP Tool Error]', toolResult);
              const textPart = toolResult.content?.find(c => c.type === 'text');
              resultText = textPart ? textPart.text : JSON.stringify(toolResult);
              resultText += `\n\nDEBUG INFO: toolArgs sent to server was: ${JSON.stringify(toolArgs)}`;
            } else {
              const textPart = toolResult.content?.find(c => c.type === 'text');
              resultText = textPart ? textPart.text : JSON.stringify(toolResult);
            }

            if (!isError) {
              if (fc.functionCall.name === 'kapruka_search_products') {
                let products = [];
                try {
                  const jsonRes = JSON.parse(resultText);
                  products = (jsonRes.results || []).map(r => ({
                    id: r.id, title: decodeHtml(r.name),
                    currency: r.price?.currency || 'LKR', price: r.price?.amount || 0,
                    stock: r.stock_level || (r.in_stock ? 'In stock' : 'Out of stock'),
                    shipping: r.ships_internationally ? 'ships internationally' : '',
                    url: r.url, image: r.image_url
                  }));
                } catch {
                  products = parseSearchResults(resultText);
                }
                lastCustomUI = { type: 'product_list', query: fc.functionCall.args.params?.q || '', data: products };
              } else if (fc.functionCall.name === 'kapruka_get_product') {
                let product = {};
                try {
                  const jsonProd = JSON.parse(resultText);
                  const p = jsonProd.product || jsonProd;
                  const imageUrl = (p.images && p.images.length > 0) ? p.images[0] : (p.image_url || '');
                  product = {
                    title: decodeHtml(p.name || p.title || ''), id: p.id || p.sku || '',
                    price: p.price?.amount ? `${p.price.currency || 'LKR'} ${p.price.amount.toLocaleString()}` : '',
                    stock: p.stock_level || (p.in_stock ? 'In stock' : 'Out of stock'),
                    category: p.category?.name || p.category || '',
                    vendor: p.attributes?.vendor || p.vendor || 'Kapruka',
                    weight: p.attributes?.weight || p.weight || 'N/A',
                    internationalShipping: p.ships_internationally ? 'Yes' : 'No',
                    description: decodeHtml(p.description_format === 'plain' ? p.description : (p.summary || p.description || '')),
                    image: imageUrl, url: p.url || '',
                    images: p.images || (imageUrl ? [imageUrl] : [])
                  };
                } catch {
                  product = { title: '', id: '', price: '', stock: '', category: '', vendor: '', weight: '', internationalShipping: '', description: '', image: '', url: '' };
                }
                lastCustomUI = { type: 'product_details', data: product };
              } else if (fc.functionCall.name === 'kapruka_check_delivery') {
                lastCustomUI = { type: 'delivery_check', data: parseDeliveryCheck(resultText) };
              } else if (fc.functionCall.name === 'kapruka_create_order') {
                lastCustomUI = { type: 'checkout', data: parseOrderCreation(resultText) };
              }
            }
          } catch (err) {
            console.error(`[Tool Error] ${fc.functionCall.name}:`, err);
            resultText = `Error: ${err.message}`;
          }

          responseParts.push({ functionResponse: { name: fc.functionCall.name, response: { result: resultText } } });
        }

        contents.push({ role: 'function', parts: responseParts });
      } else {
        let rawText = candidate?.content?.parts?.[0]?.text || '';
        let cleanText = cleanResponseText(rawText);

        if (!cleanText) {
          if (lastCustomUI?.type === 'checkout') cleanText = 'Your order has been created! Click below to complete payment 🎉';
          else if (lastCustomUI?.type === 'product_list') cleanText = "Here's what I found for you!";
          else if (lastCustomUI?.type === 'product_details') cleanText = 'Here are the full details for that product:';
          else if (lastCustomUI?.type === 'delivery_check') cleanText = "Here's the delivery info:";
          else cleanText = "Aiyo, something went wrong on my end. Try again?";
        }

        return NextResponse.json({
          role: 'assistant',
          content: cleanText,
          customUI: lastCustomUI,
          internalHistory: contents
        });
      }
    }

    return NextResponse.json({ error: 'Max tool iterations exceeded.' }, { status: 500 });
  } catch (error) {
    console.error('[Chat Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
