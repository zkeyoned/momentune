/**
 * QQ 互联扫码登录 — 生成二维码
 *
 * POST /api/qq/qr-create
 * 返回 { qrimg, key }
 *   qrimg: base64 data URL,前端直接渲染
 *   key:   `<encodeURIComponent(qrsig)>|<hash33(qrsig)>`,前端原样回传给 qr-check
 */

import {
  handleRequest,
  jsonBody,
  APPID,
  PT_3RD_AID,
  DAID,
  PTQRSHOW_URL,
  USER_AGENT,
  hash33,
  arrayBufferToBase64,
  extractSetCookies,
  fetchWithTimeout,
} from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  // 1. 请求 ptqrshow 拿二维码图片 + qrsig cookie
  const url =
    `${PTQRSHOW_URL}?appid=${APPID}&e=2&l=M&s=3&d=72&v=4` +
    `&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}` +
    `&u1=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}`;

  const upstream = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!upstream.ok) {
    jsonBody(res, 500, { error: `ptqrshow 请求失败: ${upstream.status}` });
    return;
  }

  // 2. 从 Set-Cookie 提取 qrsig
  let qrsig = '';
  for (const c of extractSetCookies(upstream.headers)) {
    const match = c.match(/qrsig=([^;]+)/);
    if (match?.[1]) {
      qrsig = match[1];
      break;
    }
  }
  if (!qrsig) {
    jsonBody(res, 500, { error: '未拿到 qrsig cookie' });
    return;
  }

  // 3. 图片 binary 转 base64 data URL
  const buf = await upstream.arrayBuffer();
  const qrimg = `data:image/png;base64,${arrayBufferToBase64(buf)}`;

  // 4. 编码 key:qrsig + ptqrtoken,前端原样回传给 qr-check
  const ptqrtoken = hash33(qrsig);
  const key = `${encodeURIComponent(qrsig)}|${ptqrtoken}`;

  jsonBody(res, 200, { qrimg, key });
});
