export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;

  // Updated working Invidious instances (2025)
  const instances = [
    'https://inv.nadeko.net',
    'https://inv1.nadeko.net',
    'https://inv2.nadeko.net',
    'https://inv3.nadeko.net',
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
  ];

  // ── SEARCH ──
  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'No query' });
    for (const base of instances) {
      try {
        const url = `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&fields=videoId,title,author,lengthSeconds,videoThumbnails&pretty=1`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(6000)
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (!Array.isArray(data) || !data.length) continue;

        // Filter out karaoke, nightcore, covers, instrumentals
        const junk = /karaoke|nightcore|instrumental|cover|remix|sped up|lofi|lo-fi|reverb|slowed/i;
        const results = data
          .filter(v => v.videoId && v.title && !junk.test(v.title))
          .slice(0, 10)
          .map(v => ({
            id: v.videoId,
            title: v.title,
            artist: v.author,
            thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
            duration: v.lengthSeconds,
          }));

        if (!results.length) continue;
        return res.status(200).json({ results, source: base });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Search failed on all instances', results: [] });
  }

  // ── GET AUDIO URL ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });
    for (const base of instances) {
      try {
        const url = `${base}/api/v1/videos/${id}?fields=adaptiveFormats,formatStreams`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (!data || data.error) continue;

        // Try adaptive audio formats first (audio only, better quality)
        const adaptive = (data.adaptiveFormats || [])
          .filter(f => f.type && f.type.startsWith('audio/') && f.url)
          .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

        // Fallback to combined format streams
        const streams = (data.formatStreams || [])
          .filter(f => f.url)
          .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

        const audioUrl = adaptive[0]?.url || streams[0]?.url;
        if (!audioUrl) continue;

        return res.status(200).json({ audioUrl, source: base });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Could not get audio from any instance' });
  }

  res.status(400).json({ error: 'Invalid action. Use action=search or action=audio' });
}
