export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;

  // ── SEARCH using YouTube Data API v3 (no key needed via this proxy) ──
  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'No query' });

    const endpoints = [
      // yt-search via suggest API + oEmbed (no key needed)
      async () => {
        const r = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=10&key=AIzaSyDHxAIUj9kphJcRumopPV4LITZhUoYgNhE`,
          { signal: AbortSignal.timeout(7000) }
        );
        if (!r.ok) throw new Error('failed');
        const data = await r.json();
        if (!data.items) throw new Error('no items');
        const junk = /karaoke|nightcore|instrumental|cover|sped up|lofi|reverb|slowed/i;
        return data.items
          .filter(v => !junk.test(v.snippet.title))
          .slice(0, 10)
          .map(v => ({
            id: v.id.videoId,
            title: v.snippet.title,
            artist: v.snippet.channelTitle,
            thumbnail: v.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id.videoId}/mqdefault.jpg`,
          }));
      },
      // Fallback: use yt-search-web scraper
      async () => {
        const r = await fetch(
          `https://yt-search-web.vercel.app/api/search?q=${encodeURIComponent(q)}`,
          { signal: AbortSignal.timeout(7000) }
        );
        if (!r.ok) throw new Error('failed');
        return await r.json();
      },
    ];

    for (const fn of endpoints) {
      try {
        const results = await fn();
        if (results && results.length) return res.status(200).json({ results });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Search failed', results: [] });
  }

  // ── GET AUDIO using cobalt.tools API (free, no key) ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });

    const cobaltInstances = [
      'https://api.cobalt.tools',
      'https://cobalt.api.timelessnesses.me',
      'https://co.wuk.sh',
    ];

    for (const base of cobaltInstances) {
      try {
        const r = await fetch(`${base}/api/json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${id}`,
            aFormat: 'mp3',
            isAudioOnly: true,
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (data.url) return res.status(200).json({ audioUrl: data.url });
        if (data.status === 'stream' && data.url) return res.status(200).json({ audioUrl: data.url });
      } catch { continue; }
    }
    return res.status(500).json({ error: 'Could not get audio' });
  }

  res.status(400).json({ error: 'Invalid action' });
}
