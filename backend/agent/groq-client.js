/**
 * AI Agent: Groq API Client
 */
const config = require('../config');

async function callGroq(messages, options = {}) {
  if (!config.GROQ_API_KEY) {
    return null; // Trigger fallback mode
  }

  try {
    const response = await fetch(config.GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || config.GROQ_MODEL,
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 1024,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', response.status, error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Groq API call failed:', error.message);
    return null;
  }
}

module.exports = { callGroq };
