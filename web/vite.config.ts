import { defineConfig, type ProxyOptions } from "vite";

const AGENT_BIND = process.env.GROK_AGENT_BIND ?? "127.0.0.1:2419";
const AGENT_SECRET = process.env.GROK_AGENT_SECRET ?? "slice0dev";

function withServerKey(path: string): string {
  const url = new URL(path || "/ws", "http://vite.local");
  if (!url.searchParams.get("server-key")) {
    url.searchParams.set("server-key", AGENT_SECRET);
  }
  return `${url.pathname}${url.search}`;
}

const agentProxy: ProxyOptions = {
  target: `http://${AGENT_BIND}`,
  ws: true,
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyReq) => {
      proxyReq.path = withServerKey(proxyReq.path ?? "/ws");
    });
    proxy.on("proxyReqWs", (proxyReq) => {
      proxyReq.path = withServerKey(proxyReq.path ?? "/ws");
    });
  },
};

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/ws": agentProxy,
    },
  },
});
