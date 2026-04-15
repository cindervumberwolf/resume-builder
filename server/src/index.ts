import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerParseJd } from "./tools/parseJd.js";
import { registerParseMasterResume } from "./tools/parseMasterResume.js";
import { registerRetrieveModules } from "./tools/retrieveModules.js";
import { registerComposeResume } from "./tools/composeResume.js";
import { registerRetrieveExemplars } from "./tools/retrieveExemplars.js";
import { registerRewriteBullet } from "./tools/rewriteBullet.js";
import { db } from "./db/client.js";

const MCP_PATH = "/mcp";
const port = Number(process.env.PORT ?? 8787);

function createResumeServer(): McpServer {
  const server = new McpServer({
    name: "resume-builder",
    version: "0.1.0",
  });

  registerParseJd(server);
  registerParseMasterResume(server);
  registerRetrieveModules(server);
  registerComposeResume(server);
  registerRetrieveExemplars(server);
  registerRewriteBullet(server);

  return server;
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end("Resume Builder MCP Server");
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createResumeServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

db();
httpServer.listen(port, () => {
  console.log(`Resume Builder MCP Server listening on http://localhost:${port}${MCP_PATH}`);
});
