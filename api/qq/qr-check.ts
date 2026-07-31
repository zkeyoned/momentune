/**
 * QQ 互联扫码登录 — 轮询扫码状态并完成登录
 *
 * POST /api/qq/qr-check  body: { key }
 *   key: qr-create 返回的 `<encodeURIComponent(qrsig)>|<ptqrtoken>`
 *
 * 返回:
 *   { code: 66, message }                    — 二维码未失效,等待扫码
 *   { code: 67, message }                    — 已扫码待确认
 *   { code: 65, message }                    — 二维码已过期
 *   { code: 0, message, cookie, nickname }   — 登录成功
 *
 * 任何一步失败抛错返回 500(由 handleRequest 兜底)。
 */

import {
  handleRequest,
  jsonBody,
  getField,
  APPID,
  PT_3RD_AID,
  DAID,
  REDIRECT_URI,
  PTQRCHECK_URL,
  AUTHORIZE_URL,
  MUSICU_URL,
  USER_AGENT,
  gtkFromPskey,
  parsePtuiCallback,
  mergeHeadersCookies,
  cookieHeader,
  getCookieValue,
  defaultGuid,
  fetchWithTimeout,
} from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const key = getField(req, 'key');
  if (!key) {
    jsonBody(res, 400, { error: '缺少 key 参数' });
    return;
  }

  // 解码 key 拿 qrsig 和 ptqrtoken
  const keyParts = key.split('|');
  const qrsigEncoded = keyParts[0];
  const ptqrtokenStr = keyParts[1];
  if (!qrsigEncoded || !ptqrtokenStr) {
    jsonBody(res, 400, { error: 'key 格式不合法' });
    return;
  }
  const qrsig = decodeURIComponent(qrsigEncoded);
  const ptqrtoken = Number(ptqrtokenStr);

  // 累积 cookies(整个登录流程共用)
  const cookies = new Map<string, string>();
  cookies.set('qrsig', `qrsig=${qrsig}`);

  // ---------------- 第 2 步:轮询扫码状态(ptqrlogin) ----------------
  const checkUrl =
    `${PTQRCHECK_URL}?u1=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}` +
    `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
    `&action=0-0-${Date.now()}&js_ver=23111510&js_type=1&login_sig=&pt_uistyle=40` +
    `&aid=${APPID}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}`;

  const checkRes = await fetchWithTimeout(checkUrl, {
    headers: {
      Cookie: cookieHeader(cookies),
      Referer: 'https://xui.ptlogin2.qq.com/',
      'User-Agent': USER_AGENT,
    },
  });

  if (!checkRes.ok) {
    jsonBody(res, 500, { error: `ptqrlogin 请求失败: ${checkRes.status}` });
    return;
  }

  // 累积 check 阶段返回的 cookie
  mergeHeadersCookies(cookies, checkRes.headers);

  const checkText = await checkRes.text();
  const { code, redirectUrl, message } = parsePtuiCallback(checkText);

  // 未成功:66 未扫码 / 67 已扫码待确认 / 65 已过期
  if (code !== 0) {
    jsonBody(res, 200, { code, message: message || '未知状态' });
    return;
  }

  if (!redirectUrl) {
    jsonBody(res, 500, { error: '登录成功但未拿到 redirect_url' });
    return;
  }

  // ---------------- 第 3 步:check_sig 换 p_skey ----------------
  const sigRes = await fetchWithTimeout(redirectUrl, {
    redirect: 'manual',
    headers: {
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
    },
  });
  mergeHeadersCookies(cookies, sigRes.headers);

  // 提取 p_skey 算 g_tk
  const pskey = getCookieValue(cookies, 'p_skey');
  if (!pskey) {
    jsonBody(res, 500, { error: '未拿到 p_skey' });
    return;
  }
  const gtk = gtkFromPskey(pskey);

  // ---------------- 第 4 步:oauth2.0/authorize 换 code ----------------
  const authorizeBody = new URLSearchParams({
    response_type: 'code',
    client_id: PT_3RD_AID,
    redirect_uri: REDIRECT_URI,
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(gtk),
    auth_time: new Date().toString(),
    ui: defaultGuid(),
  });

  const authRes = await fetchWithTimeout(AUTHORIZE_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
    },
    body: authorizeBody.toString(),
  });
  mergeHeadersCookies(cookies, authRes.headers);

  // 从 Location 头提取 code
  const location = authRes.headers.get('location') ?? '';
  const codeMatch = location.match(/[?&]code=([^&]+)/);
  const authCode = codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : '';
  if (!authCode) {
    jsonBody(res, 500, { error: '未拿到 OAuth code' });
    return;
  }

  // ---------------- 第 5 步:musicu.fcg 换 QQ 音乐 cookie ----------------
  const musicuBody = JSON.stringify({
    comm: { g_tk: gtk, platform: 'yqq', ct: 24, cv: 0 },
    req: {
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      param: { code: authCode },
    },
  });

  const musicuRes = await fetchWithTimeout(MUSICU_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/',
    },
    body: musicuBody,
  });
  mergeHeadersCookies(cookies, musicuRes.headers);

  // 解析返回,尝试拿 nickname
  let nickname = 'QQ音乐用户';
  try {
    const musicuJson = (await musicuRes.json()) as {
      req?: { data?: { nickname?: string } };
    };
    const nick = musicuJson?.req?.data?.nickname;
    if (nick) nickname = nick;
  } catch {
    // 解析失败不影响主流程,用默认 nickname
  }

  const finalCookie = cookieHeader(cookies);
  if (!finalCookie) {
    jsonBody(res, 500, { error: '登录成功但未拿到 cookie' });
    return;
  }

  jsonBody(res, 200, { code: 0, message: '登录成功', cookie: finalCookie, nickname });
});
