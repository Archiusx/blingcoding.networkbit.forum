// api/score.js
// Vercel Serverless Function — proxies AI-scoring requests to Groq.
// The browser sends the problem + student code to OUR /api/score
// (same-origin). This function calls Groq server-to-server with the
// real GROQ_API_KEY, which never reaches the browser, and returns
// just the parsed score JSON back to the client.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  if (!GROQ_API_KEY) {
    res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables.' });
    return;
  }

  try {
    const { question, language, code } = req.body || {};
    if (!question || !code) {
      res.status(400).json({ error: 'Missing question or code in request body.' });
      return;
    }

    const prompt =
`You are a strict, fair programming judge for a coding contest.

Problem: ${question.title}
Description: ${question.description}
Input format: ${question.inputFormat}
Output format: ${question.outputFormat}
Sample input: ${question.sampleInput}
Sample output: ${question.sampleOutput}

Language: ${language}
Student's code:
\`\`\`
${code}
\`\`\`

Score the submission on four criteria, each from 0 to 10 (integers):
- correctness: does it solve the problem and produce the expected output?
- logic: is the approach sound and well-structured?
- efficiency: is the time/space complexity reasonable for this problem?
- output_format: does the output exactly match the required format?

Respond with ONLY a single valid JSON object, no markdown, no extra text, in this exact shape:
{"correctness":0,"logic":0,"efficiency":0,"output_format":0,"feedback":"one short sentence of feedback"}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'You are a strict programming judge. Always respond with only valid JSON, nothing else.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const bodyText = await groqRes.text();

    if (!groqRes.ok) {
      res.status(groqRes.status).json({
        error: `Groq API responded with ${groqRes.status}`,
        detail: bodyText
      });
      return;
    }

    const data = JSON.parse(bodyText);
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) {
      res.status(502).json({ error: 'Empty response from Groq' });
      return;
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      res.status(502).json({ error: 'Could not parse scoring response', detail: raw });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      res.status(502).json({ error: 'Scoring response was not valid JSON', detail: raw });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(502).json({ error: 'Proxy failed to reach Groq', detail: String(err && err.message || err) });
  }
}
