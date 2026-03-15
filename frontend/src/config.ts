// ==========================================
// 🚀 ENVIRONMENT SWITCHER
// ==========================================
// Change this single variable to switch the entire frontend 
// between Local Development and Production deployments.

export const ENV: 'local' | 'prod' = 'prod'; // <--- Change to 'prod' before deploying to AWS

const CONFIG = {
    local: {
        // Local: API requests go to Next.js (which proxies them to FastAPI via next.config.ts)
        API_URL: "",
        
        // Local: LiveKit SDK connects directly to localhost
        LIVEKIT_URL: "ws://localhost:7880",
    },
    prod: {
        // Prod: API requests use relative paths (intercepted by Caddy reverse proxy)
        API_URL: "", 
        
        // Prod: LiveKit SDK connects securely to your DuckDNS domain
        LIVEKIT_URL: "wss://bolchal.duckdns.org",
    }
};

export const AppConfig = CONFIG[ENV];
