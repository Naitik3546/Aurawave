export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, id } = req.query;
  const YT_KEY = 'AIzaSyDHxAIUj9kphJcRumopPV4LITZhUoYgNhE';

  // ── SEARCH ──
  if (action === 'search') {
    if (!q) return res.status(400).json({ error: 'No query', results: [] });
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

  // ── GET AUDIO via YouTube Innertube API ──
  if (action === 'audio') {
    if (!id) return res.status(400).json({ error: 'No video ID' });
    try {
      // Use YouTube's internal API (same as what the website uses)
      const body = {
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '18.11.34',
            androidSdkVersion: 30,
            userAgent: 'com.google.android.youtube/18.11.34 (Linux; U; Android 11) gzip',
            hl: 'en',
            timeZone: 'UTC',
            utcOffsetMinutes: 0
          }
        },
        videoId: id,
        params: 'CgIQBg=='
      };

      const r = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/18.11.34 (Linux; U; Android 11) gzip',
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '18.11.34',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
      });

      const data = await r.json();
      const formats = data?.streamingData?.adaptiveFormats || data?.streamingData?.formats || [];
      
      // Get best audio-only format
      const audioFormats = formats
        .filter(f => f.mimeType?.includes('audio') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      const audioUrl = audioFormats[0]?.url;
      if (!audioUrl) {
        return res.status(500).json({ error: 'No audio format found', status: data?.playabilityStatus?.status });
      }

      return res.status(200).json({ audioUrl });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: 'Invalid action' });
}
