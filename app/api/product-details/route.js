import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const KAPRUKA_MCP_URL = 'https://mcp.kapruka.com/mcp';

let mcpClient = null;
let mcpInitPromise = null;

async function initMcp() {
  if (mcpClient) return;
  if (mcpInitPromise) return mcpInitPromise;
  mcpInitPromise = (async () => {
    const transport = new StreamableHTTPClientTransport(new URL(KAPRUKA_MCP_URL));
    const client = new Client({ name: 'kapruka-product-details', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    mcpClient = client;
  })();
  return mcpInitPromise;
}

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
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

export async function POST(request) {
  try {
    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    await initMcp();

    if (!mcpClient) {
      return NextResponse.json({ error: 'MCP not initialized' }, { status: 503 });
    }

    const result = await mcpClient.callTool({
      name: "kapruka_get_product",
      arguments: { params: { product_id: productId, response_format: "json" } }
    });

    const textPart = result.content?.find(c => c.type === "text");
    const rawText = textPart ? textPart.text : "{}";
    const product = parseProductDetail(rawText);
    
    return NextResponse.json({ product });
  } catch (error) {
    console.error('[Product Details Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
