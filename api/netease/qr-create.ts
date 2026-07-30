/**
 * 网易云扫码登录 — 生成二维码
 *
 * POST /api/netease/qr-create
 * 返回 { unikey, qrimg } — qrimg 是 base64 data URL,前端直接渲染
 */

import { handleRequest, jsonBody, callNetease } from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  // 1. 生成 unikey
  const keyResult = await callNetease('login_qr_key', { timestamp: Date.now() });
  const unikey = keyResult?.data?.unikey as string | undefined;
  if (!unikey) {
    jsonBody(res, 500, { error: '获取二维码 key 失败' });
    return;
  }

  // 2. 生成二维码图片(base64)
  const createResult = await callNetease('login_qr_create', {
    key: unikey,
    qrimg: true,
    timestamp: Date.now(),
  });
  const qrimg = createResult?.data?.qrimg as string | undefined;
  if (!qrimg) {
    jsonBody(res, 500, { error: '生成二维码失败' });
    return;
  }

  jsonBody(res, 200, { unikey, qrimg });
});
