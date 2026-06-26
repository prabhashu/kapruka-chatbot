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
    const client = new Client({ name: 'kapruka-cities-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    mcpClient = client;
  })();
  return mcpInitPromise;
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    await initMcp();

    if (!mcpClient) {
      return NextResponse.json({ error: 'MCP not initialized' }, { status: 503 });
    }

    const mcpRes = await mcpClient.callTool({
      name: 'kapruka_list_delivery_cities',
      arguments: { params: { query } }
    });

    const textPart = mcpRes.content?.find(c => c.type === 'text');
    if (!textPart) return NextResponse.json([]);

    return NextResponse.json(parseCities(textPart.text));
  } catch (error) {
    console.error('[Cities Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
