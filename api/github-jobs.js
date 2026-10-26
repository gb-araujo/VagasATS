export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const repo = url.searchParams.get('repo');
    if (!repo) {
      return res.status(400).json({ error: 'Missing repo parameter' });
    }

    const ghUrl = `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=100`;
    const ghRes = await fetch(ghUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vagas-ats-app',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {})
      }
    });

    if (ghRes.ok) {
      const data = await ghRes.json();
      return res.status(200).json(data);
    }

    return res.status(200).json([]);
  } catch (err) {
    return res.status(200).json([]);
  }
}
