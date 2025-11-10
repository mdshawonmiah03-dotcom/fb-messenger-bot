// api/webhook.js
// Use CommonJS style for Vercel Node serverless functions to avoid module mismatch.
const fetch = require('node-fetch'); // optional if you need to call Graph API later

module.exports = async (req, res) => {
  try {
    // Basic health-check route
    if (req.method === 'GET') {
      const mode = req.query && req.query['hub.mode'];
      const token = req.query && req.query['hub.verify_token'];
      const challenge = req.query && req.query['hub.challenge'];

      // safe read env
      const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '';

      console.log('GET verify request', { mode, token, challenge, VERIFY_TOKEN_PRESENT: !!VERIFY_TOKEN });

      if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
        console.log('✅ Verification success');
        return res.status(200).send(challenge);
      } else {
        console.warn('⚠️ Verification failed', { mode, tokenMatches: token === VERIFY_TOKEN });
        return res.status(403).send('Verification failed');
      }
    }

    // Handle incoming events
    if (req.method === 'POST') {
      // Log incoming body for debugging
      console.log('📩 Incoming POST body:', JSON.stringify(req.body).slice(0, 10000));

      // Basic expected shape check
      const body = req.body || {};
      if (body.object === 'page') {
        // respond quickly so Facebook won't retry
        res.status(200).json({ status: 'EVENT_RECEIVED' });

        // Process entries asynchronously (don't wait)
        (async () => {
          try {
            for (const entry of body.entry || []) {
              // messaging events
              if (entry.messaging) {
                for (const ev of entry.messaging) {
                  console.log('Event messaging:', ev);
                  // Example: simple echo reply (later use PAGE_TOKEN)
                  if (ev.message && ev.sender && ev.sender.id) {
                    const psid = ev.sender.id;
                    const text = (ev.message.text || '').slice(0, 1000);
                    console.log(`Would reply to PSID=${psid} text="${text}"`);
                    // sendMessageToUser(psid, `Thanks! You said: "${text}"`);
                  }
                }
              }

              // feed / comments
              if (entry.changes) {
                for (const change of entry.changes) {
                  console.log('Entry change:', change);
                }
              }
            }
          } catch (innerErr) {
            console.error('Error processing entries:', innerErr);
          }
        })();

        return; // we've already sent 200
      }

      // unknown POST shape
      console.warn('Unknown POST body shape', body);
      return res.status(404).send('Not a page event');
    }

    // other methods
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).send('Method Not Allowed');
  } catch (err) {
    console.error('Unhandled error in webhook handler:', err);
    return res.status(500).send('Server error');
  }
};

// Optional helper to send a message (uncomment if using)
// async function sendMessageToUser(psid, text) {
//   const PAGE_TOKEN = process.env.PAGE_TOKEN || '';
//   if (!PAGE_TOKEN) {
//     console.warn('No PAGE_TOKEN set, skipping send');
//     return;
//   }
//   const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`;
//   await fetch(url, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ messaging_type: 'RESPONSE', recipient: { id: psid }, message: { text } })
//   });
// }

