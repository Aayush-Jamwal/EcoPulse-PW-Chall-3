// Vercel Serverless Function: api/coach.js
// Securely proxies requests to Google Gemini API to hide credentials from client-side code

/**
 * Vercel Serverless Request Handler.
 * Proxies message queries and sustainability context securely to the Gemini API.
 * Returns an HTTP 503 error if the API key is not configured.
 *
 * @param {import('@vercel/node').VercelRequest} req - The Vercel request object containing prompt and context payload
 * @param {import('@vercel/node').VercelResponse} res - The Vercel response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, context } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fix #9: Return 503 (Service Unavailable) instead of 200.
    // A 200 response caused app.js to treat this as a successful Gemini reply and
    // attempt to read data.text (undefined), silently swallowing the error and
    // bypassing the offline simulation fallback. 503 correctly sets response.ok = false.
    return res.status(503).json({ error: 'GEMINI_API_KEY environment variable is not configured on Vercel.' });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${context}\n\nUser Question: ${prompt}` }]
          }
        ]
      })
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Gemini API responded with status ${response.status}` });
    }

    const json = await response.json();
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
      const text = json.candidates[0].content.parts[0].text.trim();
      return res.status(200).json({ text });
    }

    return res.status(500).json({ error: 'Malformed response from Gemini API' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
