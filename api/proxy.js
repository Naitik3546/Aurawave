export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.query.path || '';
  if (!path) return res.status(400).json({ error: 'No path provided' });

  try {
    const url = `https://jiosaavn-api-sigma-sandy.vercel.app${path}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
```

**Note:** `/api` hata diya URL se — direct `/search/songs` jaayega! 🔥

Phir browser mein test karo:
```
https://aurawave-flame.vercel.app/api/proxy?path=/api/search/songs?query=bairan&limit=1&page=1
