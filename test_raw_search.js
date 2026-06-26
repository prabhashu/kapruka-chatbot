import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function test() {
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.kapruka.com/mcp"));
  const mcpClient = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: {} }
  );
  await mcpClient.connect(transport);
  
  const toolResult = await mcpClient.callTool({
    name: "kapruka_search_products",
    arguments: { params: { q: "chocolate" } }
  });
  
  console.log(toolResult.content[0].text);
  process.exit(0);
}
test();
