import axios from 'axios';
import CryptoJS from 'crypto-js';

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

    // 嘗試直接在 HTML 裡找 a/b/c
    const aMatch = html.match(/var\s+a=toNumbers\("([0-9a-fA-F]+)"\)/);
    const bMatch = html.match(/,\s*b=toNumbers\("([0-9a-fA-F]+)"\)/);
    const cMatch = html.match(/,\s*c=toNumbers\("([0-9a-fA-F]+)"\)/);

    if (!aMatch || !bMatch || !cMatch) {
      // 如果解析不到，回傳 HTML 前 500 字方便分析
      return res.status(502).json({
        error: 'Challenge parse failed',
        htmlSnippet: html.slice(0, 500)
      });
    }

    // 解析成功 → 解密 cookie
    const aHex = aMatch[1];
    const bHex = bMatch[1];
    const cHex = cMatch[1];

    const key = CryptoJS.enc.Hex.parse(aHex);
    const iv = CryptoJS.enc.Hex.parse(bHex);
    const ciphertext = CryptoJS.enc.Hex.parse(cHex);

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      key,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding }
    );

    const cookieValue = decrypted.toString(CryptoJS.enc.Hex);

    // 第二次請求：帶 cookie 拿 JSON
    const second = await axios.get(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Cookie': `__test=${cookieValue}`
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json(second.data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', detail: err.message });
  }
}
