import http from "http";
import { execSync } from "child_process";
import os from "os";
import express from "express";
import cors from "cors";
import ingestRoutes from "./routes/ingest";
import consumeRoutes from "./routes/consume";
import capturesRoutes from "./routes/captures";
import healthRoutes from "./routes/health";
import { attachWebSocket } from "./ws/handler";
import { initPolymarketForwarder } from "./forward/polymarket";

export function createServer(): { app: express.Express; server: http.Server } {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/ingest", ingestRoutes);
  app.use("/", consumeRoutes);
  app.use("/", capturesRoutes);
  app.use("/", healthRoutes);

  const server = http.createServer(app);
  attachWebSocket(server);

  return { app, server };
}

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || "8420", 10);
  const { server } = createServer();

  // Only init forwarder if explicitly set (webapp now handles analysis directly)
  const POLYMARKET_WS_URL = process.env.POLYMARKET_WS_URL;
  if (POLYMARKET_WS_URL) {
    initPolymarketForwarder(POLYMARKET_WS_URL);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Relay server listening on 0.0.0.0:${PORT} (reachable from your LAN)`);
    console.log(`  REST:  http://localhost:${PORT}/health`);
    const ifs = os.networkInterfaces();
    const v4: string[] = [];
    for (const name of Object.keys(ifs)) {
      for (const net of ifs[name] ?? []) {
        if (net.family === "IPv4" && !net.internal) v4.push(`${net.address} (${name})`);
      }
    }
    if (v4.length) {
      console.log(`  Set RelayHost in the iOS app to your Mac's Wi‑Fi address, e.g.:`);
      for (const line of v4) console.log(`    ${line}`);
    }
    if (process.platform === "darwin") {
      try {
        const shortName = execSync("scutil --get LocalHostName", { encoding: "utf8" }).trim();
        if (shortName) {
          console.log(
            `  If the IP times out on iPhone, try RelayHost: ${shortName}.local (same Wi‑Fi, Local Network ON)`,
          );
        }
      } catch {
        /* ignore */
      }
    }
    console.log(`  WS:    ws://localhost:${PORT}/ws/frames`);
    console.log(`  WS:    ws://localhost:${PORT}/ws/transcript`);
    console.log(`  WS:    ws://localhost:${PORT}/ws/all`);
    if (POLYMARKET_WS_URL) {
      console.log(`  FWD:   ${POLYMARKET_WS_URL}`);
    }
  });
}
