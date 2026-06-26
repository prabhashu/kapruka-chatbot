import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function test() {
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.kapruka.com/mcp"));
  const mcpClient = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: {} }
  );
  await mcpClient.connect(transport);
  
  const tools = await mcpClient.listTools();
  console.log(JSON.stringify(tools.tools.find(t => t.name === 'kapruka_search_products'), null, 2));
  process.exit(0);
}
test();
