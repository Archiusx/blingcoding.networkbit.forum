// api/env.js
// Vercel Serverless Function — reads real environment variables on the
// server and hands the browser a small JS snippet that sets
// window.__ENV__. This is how a static index.html gets "env vars"
// without a build step. The secret values never sit in your HTML/JS
// source in the repo — they only exist in Vercel's dashboard and are
// injected at request time.

export default function handler(req, res) {
  const env = {
    // GROQ_API_KEY / GROQ_MODEL intentionally NOT sent to the browser —
    // /api/score.js uses them server-side only.
    // COMPILER_API_KEY intentionally NOT sent to the browser either —
    // /api/run.js uses it server-side only. Sending real secrets to the
    // client is unnecessary exposure once a proxy exists.
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  };

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // Cache lightly — safe to re-fetch on every deploy since Vercel
  // versions the function; avoid long caching in case keys rotate.
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`window.__ENV__ = ${JSON.stringify(env)};`);
}
