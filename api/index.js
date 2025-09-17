import axios from 'axios';

export default async function handler(req, res) {
  const station = req.query.station || 'B35';
  const target = `https://ecu3.gt.tc/${station}/update_cache.php`;

  try {
    // 第一次請求：抓取 InfinityFree 防護頁
    const first = await axios.get(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = first.data;

    // 直接回傳 HTML 原始碼
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch HTML',
      detail: err.message
    });
  }
}
