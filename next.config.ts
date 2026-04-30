import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to ALL routes
        // NOTE: CSP is handled dynamically in middleware.ts with nonce generation
        source: "/(.*)",
        headers: [
          // ── X-Frame-Options ──────────────────────────────────────
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // ── X-Content-Type-Options ───────────────────────────────
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // ── Referrer-Policy ──────────────────────────────────────
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // ── Permissions-Policy ───────────────────────────────────
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          // ── Strict-Transport-Security ────────────────────────────
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // ── X-DNS-Prefetch-Control ───────────────────────────────
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // ── X-Permitted-Cross-Domain-Policies ────────────────────
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          // ── Cross-Origin-Opener-Policy ───────────────────────────
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          // ── Cross-Origin-Resource-Policy ─────────────────────────
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // ── Cross-Origin-Embedder-Policy ─────────────────────────
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
