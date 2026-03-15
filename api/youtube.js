export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;

  // Piped API instances (different from Invidious)
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.coldforge.xyz',
    'https://pipedapi.drgns.space',
    'https://api.piped.yt',
  ];

  // ── SEARCH ──
  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'No query' });

    for (const base of pipedInstances) {
      try {
        const url = `${base}/search?q=${encodeURIComponent(q)}&filter=videos`;
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(7000)
        });
        if (!r.ok) continue;
        const data = await r.json();
        const items = data.items || data.results || [];
        if (!items.length) continue;

        const junk = /karaoke|nightcore|instrumental|cover|sped up|lofi|lo-fi|reverb|slowed/i;
        const results = items
          .filter(v => v.url && v.title && !junk.test(v.title))
          .slice(0, 10)
          .map(v => ({
            id: v.url.replace('/watch?v=', ''),
            title: v.title,
            artist: v.uploaderName || v.author || '',
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.url.replace('/watch?v=','')}/mqdefault.jpg`,
            duration: v.duration,
          }));

        if (!results.length) continue;
        return res.status(200).json({ results, source: base });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Search failed', results: [] });
  }

  // ── GET AUDIO URL ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });

    for (const base of pipedInstances) {
      try {
        const url = `${base}/streams/${id}`;
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (!data || data.error) continue;

        // Get best audio stream
        const audioStreams = (data.audioStreams || [])
          .filter(s => s.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        const audioUrl = audioStreams[0]?.url;
        if (!audioUrl) continue;

        return res.status(200).json({ audioUrl, source: base });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Could not get audio' });
  }

  res.status(400).json({ error: 'Invalid action' });
}
