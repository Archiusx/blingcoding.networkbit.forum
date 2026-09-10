// api/run.js
// Vercel Serverless Function — proxies code-run requests to OneCompiler.
// The browser calls OUR /api/run endpoint (same-origin, no CORS issue).
// This function then calls onecompiler.com server-to-server (servers
// talking to servers are never blocked by CORS — CORS is a browser-only
// restriction) using the real COMPILER_API_KEY, which stays on the
// server and is never sent to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const COMPILER_API_KEY = process.env.COMPILER_API_KEY || '';
  if (!COMPILER_API_KEY) {
    res.status(500).json({ error: 'COMPILER_API_KEY is not set in Vercel environment variables.' });
    return;
  }

  try {
    const { language, stdin, files } = req.body || {};
    if (!language || !files) {
      res.status(400).json({ error: 'Missing language or files in request body.' });
      return;
    }

    const ocRes = await fetch(
      `https://onecompiler.com/api/v1/run?access_token=${encodeURIComponent(COMPILER_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, stdin: stdin || '', files })
      }
    );

    const text = await ocRes.text();

    if (!ocRes.ok) {
      res.status(ocRes.status).json({
        error: `OneCompiler responded with ${ocRes.status}`,
        detail: text
      });
      return;
    }

    // Pass the JSON straight through to the browser.
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy failed to reach OneCompiler', detail: String(err && err.message || err) });
  }
}
