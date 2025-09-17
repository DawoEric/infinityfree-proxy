import axios from 'axios';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
  const station = req.query.station || 'B35';
  const target = `https://ecu3.gt.tc/${station}/update_cache.php`;

  try {
    // 第一次請求：拿到防護頁面
    const first = await axios.get(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = first.data;
    const $ = cheerio.load(html);

    // 擷取 a, b, c
    const script = $('script').html() || '';
    const aMatch = script.match(/var\s+a=toNumbers\("([0-9a-fA-F]+)"\)/);
    const bMatch = script.match(/,\s*b=toNumbers\("([0-9a-fA-F]+)"\)/);
    const cMatch = script.match(/,\s*c=toNumbers\("([0-9a-fA-F]+)"\)/);

    if (!aMatch || !bMatch || !cMatch) {
      return res.status(502).json({ error: 'Challenge parse failed' });
    }

    const aHex = aMatch[1];
    const bHex = bMatch[1];
    const cHex = cMatch[1];

    const key = CryptoJS.enc.Hex.parse(aHex);
    const iv = CryptoJS.enc.Hex.parse(bHex);
    const ciphertext = CryptoJS.enc.Hex.parse(cHex);

    // 解密 cookie（ZeroPadding）
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
