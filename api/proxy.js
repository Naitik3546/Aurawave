export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.query.path || '';
  if (!path) return res.status(400).json({ error: 'No path provided' });

  // Try multiple base URLs in order — first successful one wins
  const bases = [
    'https://saavn.dev/api',
    'https://jiosaavn-api-sigma-sandy.vercel.app/api/v1',
    'https://jiosaavn-api-sigma-sandy.vercel.app/api',
    'https://jiosaavn-api-sigma-sandy.vercel.app',
  ];

  for (const base of bases) {
    try {
      const url = `${base}${path}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        }
      });
      if (!response.ok) continue;
      const data = await response.json();
      // If saavn returns a "route not found" error, try next base
      if (data && data.status === 'FAILED') continue;
      return res.status(200).json(data);
    } catch (e) {
      continue;
    }
  }

  res.status(500).json({ error: 'All API endpoints failed.' });
}
