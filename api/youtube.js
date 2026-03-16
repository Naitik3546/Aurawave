import ytdl from '@distube/ytdl-core';

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

  // ── STREAM AUDIO directly via ytdl-core ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });
    try {
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${id}`);
      const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
      if (!format?.url) throw new Error('No audio format found');
      return res.status(200).json({ audioUrl: format.url });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: 'Invalid action' });
}
