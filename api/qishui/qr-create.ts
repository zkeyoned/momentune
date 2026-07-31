/**
 * 汽水音乐扫码登录 — 生成二维码
 *
 * POST /api/qishui/qr-create
 * 返回 { qrimg, token } — qrimg 是 data:image/png;base64,... 可直接 <img src>
 *
 * 端点:GET https://api.qishui.com/passport/web/get_qrcode/
 * 参考实现:Mineradio-Tauri soda-qr-login.ts
 *
 * 注意:URL 必须包含 account_sdk_source_info / iid / version_code 等反风控参数,
 *      缺失会返回 error_code=4031 "版本过低"。
 */

import {
  handleRequest,
  jsonBody,
  fetchWithTimeout,
  readJsonBody,
  asObj,
  readString,
  buildSodaHeaders,
  SODA_QR_CODE_URL,
} from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(SODA_QR_CODE_URL, {
      method: 'GET',
      headers: buildSodaHeaders(),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求汽水音乐 get_qrcode 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `get_qrcode 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  const root = asObj(body);
  const data = asObj(root?.data);

  // 校验 message === 'success'(Mineradio readSodaQrCodeBody 契约)
  const message = readString(root?.message) ?? '';
  if (message !== 'success') {
    const desc = readString(data?.description) ?? message;
    jsonBody(res, 500, { error: `get_qrcode 失败: ${desc}` });
    return;
  }

  const qrcode = readString(data?.qrcode);
  const token = readString(data?.token);

  if (!qrcode || !token) {
    jsonBody(res, 500, { error: 'get_qrcode 未返回 qrcode 或 token' });
    return;
  }

  // qrcode 是 data:image/png;base64,... 前端直接 <img src=qrimg>
  jsonBody(res, 200, { qrimg: qrcode, token });
});
