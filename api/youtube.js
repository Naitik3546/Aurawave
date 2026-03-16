import playdl from 'play-dl';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;
  const YT_KEY = 'AIzaSyDHxAIUj9kphJcRumopPV4LITZhUoYgNhE';

  // ── SEARCH via YouTube Data API ──
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

  // ── GET AUDIO URL via play-dl ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });
    try {
      const stream = await playdl.stream(`https://www.youtube.com/watch?v=${id}`, { quality: 2 });
      const audioUrl = stream?.stream?.url || null;
      if (!audioUrl) throw new Error('No URL found');
      return res.status(200).json({ audioUrl });
    } catch(e) {
      // Fallback: try getting info directly
      try {
        const info = await playdl.video_info(`https://www.youtube.com/watch?v=${id}`);
        const formats = info?.format || [];
        const audio = formats.find(f => f.mimeType?.includes('audio'));
        if (audio?.url) return res.status(200).json({ audioUrl: audio.url });
      } catch {}
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: 'Invalid action' });
}
