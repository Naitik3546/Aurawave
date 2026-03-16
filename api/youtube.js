export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;
  const YT_KEY = 'AIzaSyDHxAIUj9kphJcRumopPV4LITZhUoYgNhE';

  // ── SEARCH ──
  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'No query' });
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=10&key=${YT_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await r.json();
      if (!data.items) return res.status(500).json({ error: 'No results', results: [] });
      const junk = /karaoke|nightcore|instrumental|cover|sped up|lofi|reverb|slowed/i;
      const results = data.items
        .filter(v => !junk.test(v.snippet.title))
        .slice(0, 10)
        .map(v => ({
          id: v.id.videoId,
          title: v.snippet.title,
          artist: v.snippet.channelTitle,
          thumbnail: v.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id.videoId}/mqdefault.jpg`,
        }));
      return res.status(200).json({ results });
    } catch(e) {
      return res.status(500).json({ error: e.message, results: [] });
    }
  }

  // ── GET AUDIO URL via multiple free services ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });

    const ytUrl = `https://www.youtube.com/watch?v=${id}`;

    // Try multiple free audio extraction services
    const services = [
      // 1. y2mate API
      async () => {
        const r = await fetch('https://www.y2mate.com/mates/analyzeV2/ajax', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `k_query=${encodeURIComponent(ytUrl)}&k_page=home&hl=en&q_auto=0`,
          signal: AbortSignal.timeout(8000)
        });
        const d = await r.json();
        const mp3 = d?.links?.mp3?.mp3128;
        if (!mp3?.k) throw new Error('no key');
        const r2 = await fetch('https://www.y2mate.com/mates/convertV2/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `vid=${id}&k=${mp3.k}`,
          signal: AbortSignal.timeout(8000)
        });
        const d2 = await r2.json();
        if (!d2?.dlink) throw new Error('no link');
        return d2.dlink;
      },
      // 2. loader.to
      async () => {
        const r = await fetch(`https://loader.to/api/button/?url=${encodeURIComponent(ytUrl)}&f=mp3`, {
          signal: AbortSignal.timeout(8000)
        });
        const d = await r.json();
        if (!d?.url) throw new Error('no url');
        return d.url;
      },
      // 3. yt-dlp via yt-download.org
      async () => {
        const r = await fetch(`https://yt-download.org/api/button/mp3?url=${encodeURIComponent(ytUrl)}`, {
          signal: AbortSignal.timeout(8000)
        });
        const d = await r.json();
        if (!d?.url) throw new Error('no url');
        return d.url;
      },
    ];

    for (const fn of services) {
      try {
        const audioUrl = await fn();
        if (audioUrl) return res.status(200).json({ audioUrl });
      } catch { continue; }
    }

    return res.status(500).json({ error: 'Could not get audio from any service' });
  }

  res.status(400).json({ error: 'Invalid action' });
}
