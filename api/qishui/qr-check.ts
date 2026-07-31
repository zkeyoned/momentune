/**
 * 汽水音乐扫码登录 — 轮询扫码状态
 *
 * POST /api/qishui/qr-check  body: { token }
 *
 * 返回:
 *   { code: 0, status: 'new',       message: '等待扫码' }
 *   { code: 1, status: 'scanned',   message: '已扫码',  avatarUrl }
 *   { code: 2, status: 'confirmed', message: '登录成功', cookie }
 *   { code: 3, status: 'expired',   message: '二维码已过期', newToken }
 *
 * 端点:POST https://api.qishui.com/passport/web/check_qrconnect/
 *   - body 为 application/x-www-form-urlencoded
 *   - 成功登录后,cookie 在 Set-Cookie 响应头中,需提取
 *
 * 关键:用 data.status 字段判断状态(对齐 Mineradio readSodaQrCheckBody):
 *   - "new"       → 等待扫码
 *   - "scanned"   → 已扫码待确认
 *   - "confirmed" → 登录成功
 *   - "expired"   → 过期
 * 不要用 error_code 判断,登录成功时 error_code 不是固定值。
 *
 * 参考实现:Mineradio-Tauri soda-qr-login.ts
 */

import {
  handleRequest,
  jsonBody,
  getField,
  fetchWithTimeout,
  readJsonBody,
  asObj,
  readString,
  cookieFromSetCookieHeaders,
  buildSodaHeaders,
  SODA_QR_CHECK_URL,
  SODA_API_CONFIG,
} from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const token = getField(req, 'token');
  if (!token) {
    jsonBody(res, 400, { error: '缺少 token 参数' });
    return;
  }

  // check_qrconnect URL(含完整反风控参数,见 _shared.ts SODA_QR_CHECK_URL)
  const url = SODA_QR_CHECK_URL;

  // POST body: application/x-www-form-urlencoded(对齐 Mineradio)
  const formBody =
    `need_logo=false` +
    `&need_short_url=false` +
    `&is_frontier=true` +
    `&token=${encodeURIComponent(token)}` +
    `&is_new_login=1` +
    `&next=${encodeURIComponent(SODA_API_CONFIG.API_BASE)}`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: buildSodaHeaders({
        contentType: 'application/x-www-form-urlencoded',
      }),
      body: formBody,
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 check_qrconnect 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `check_qrconnect 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  const root = asObj(body) ?? {};
  const data = asObj(root.data) ?? {};

  // Mineradio 契约:message !== "success" 视为请求失败
  const message = readString(root.message) ?? '';
  if (message !== 'success') {
    const desc = readString(data.description) ?? message ?? '未知错误';
    jsonBody(res, 500, { error: `check_qrconnect 失败: ${desc}` });
    return;
  }

  // 核心:用 status 字段判断(不要用 error_code)
  const status = readString(data.status) ?? '';
  // 已扫码时返回 scan_user_info.avatar_url
  const scanUserInfo = asObj(data.scan_user_info);
  const avatarUrl = readString(scanUserInfo?.avatar_url);

  // 1) 等待扫码(status="new")
  if (status === 'new' || status === '') {
    jsonBody(res, 200, { code: 0, status: 'new', message: '等待扫码' });
    return;
  }

  // 2) 已扫码(status="scanned",带 avatar_url)
  if (status === 'scanned' || (avatarUrl && status !== 'confirmed')) {
    jsonBody(res, 200, {
      code: 1,
      status: 'scanned',
      message: '已扫码,待确认',
      avatarUrl,
    });
    return;
  }

  // 3) 登录成功(status="confirmed"):从 Set-Cookie 提取 cookie
  if (status === 'confirmed') {
    const cookie = cookieFromSetCookieHeaders(resp.headers);
    if (!cookie) {
      jsonBody(res, 500, { error: '登录成功但 Set-Cookie 头缺失' });
      return;
    }
    jsonBody(res, 200, {
      code: 2,
      status: 'confirmed',
      message: '登录成功',
      cookie,
    });
    return;
  }

  // 4) 过期(status="expired"):尝试从 data 拿新 token(刷新二维码)
  if (status === 'expired') {
    const newToken = readString(data.token);
    jsonBody(res, 200, {
      code: 3,
      status: 'expired',
      message: '二维码已过期',
      newToken: newToken && newToken !== token ? newToken : undefined,
    });
    return;
  }

  // 兜底:无法识别的 status,视为过期让用户重试
  jsonBody(res, 200, {
    code: 3,
    status: 'expired',
    message: `未知状态: ${status || '空'}`,
    newToken: undefined,
  });
});
