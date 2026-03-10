# Public Deployment Guide via Cloudflare Tunnels

To make your locally-hosted Meeting Ghost AI video platform accessible to people on the internet (so they can join your meetings from anywhere), we will use **Cloudflare Tunnels**. 

Cloudflare Tunnels are completely free and securely expose your local Docker containers to the web without needing to open router ports or expose your home IP address.

## How do you want to proceed?

### Option 1: Quick TryCloudflare Tunnel (No Account Needed)
We can instantly generate a random ephemeral URL (e.g., `https://random-words.trycloudflare.com`) that routes directly to your frontend.
* **Pros:** Instant, zero setup, no account required.
* **Cons:** The URL changes every time you restart it.

### Option 2: Permanent Custom Domain Tunnel
If you have a free Cloudflare account and a registered domain (e.g., `yourdomain.com`), we can set up a permanent subdomain (e.g., `meet.yourdomain.com`) that always points to your laptop.
* **Pros:** Professional URL, permanent, reliable.
* **Cons:** Requires logging into Cloudflare and having a domain name.

### Technical Note on Video Traffic (WebRTC)
LiveKit WebRTC relies heavily on UDP traffic for fast, low-latency video. Cloudflare Tunnels only proxy TCP (HTTP/WebSocket). LiveKit *will* automatically fallback to TCP through the tunnel, but video quality may be slightly degraded compared to a direct UDP connection. For a production app, deploying the LiveKit Server to a cheap cloud VPS (like Hetzner/DigitalOcean) is recommended, while keeping the AI Engine on your powerful local laptop.

---
**Please let me know if you want to proceed with Option 1 (Quick Tunnel) or Option 2 (Permanent Tunnel)!**
