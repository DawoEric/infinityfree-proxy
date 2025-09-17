import axios from 'axios';
import cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
  const { station = 'B35' } = req.query;
  const target = `https://ecu3.gt.tc/${station}/update_cache.php`;

  try {
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
    const script = $('script').html() || '';

    const a = script.match(/var\s+a=toNumbers\("([0-9a-fA-F]+)"\)/)?.[1];
    const b = script.match(/,\s*b=toNumbers\("([0-9a-fA-F]+)"\)/)?.[1];
    const c = script.match(/,\s*c=toNumbers\("([0-9a-fA-F]+)"\)/)?.[1];

    if (!a || !b || !c) {
      return res.status(502).json({ error: 'Challenge parse failed', a, b, c });
    }

    const key = CryptoJS.enc.Hex.parse(a);
    const iv = CryptoJS.enc.Hex.parse(b);
    const ciphertext = CryptoJS.enc.Hex.parse(c);

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      key,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding }
    );

    const cookieValue = decrypted.toString(CryptoJS.enc.Hex);

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
