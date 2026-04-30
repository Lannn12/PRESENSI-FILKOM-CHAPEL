import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to ALL routes
        source: "/(.*)",
        headers: [
          // ── Content-Security-Policy ──────────────────────────────
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
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
        ],
      },
    ];
  },
};

export default nextConfig;
