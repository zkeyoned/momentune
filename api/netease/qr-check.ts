/**
 * 网易云扫码登录 — 轮询扫码状态
 *
 * POST /api/netease/qr-check  body: { unikey }
 *
 * 返回:
 *   { code: 801, message: '等待扫码' }
 *   { code: 802, message: '已扫码,待确认' }
 *   { code: 800, message: '二维码已过期' }
 *   { code: 803, cookie, nickname, uid }  — 登录成功
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const unikey = getField(req, 'unikey');
  if (!unikey) {
    jsonBody(res, 400, { error: '缺少 unikey 参数' });
    return;
  }

  // 1. 检查扫码状态
  // login_qr_check 返回格式: { code: 801/802/803/800, message, cookie } — 在 body 顶层,不在 data 里
  const checkResult = await callNetease<Record<string, unknown>>('login_qr_check', {
    key: unikey,
    timestamp: Date.now(),
  });
  const code = checkResult?.code as number;
  const message = checkResult?.message as string | undefined;

  // 未成功,返回状态码(803 = 登录成功)
  if (code !== 803) {
    jsonBody(res, 200, { code, message: message ?? '未知状态' });
    return;
  }

  // 2. 登录成功,提取 cookie
  const cookie = (checkResult?.cookie as string) ?? '';
  if (!cookie) {
    jsonBody(res, 500, { error: '登录成功但未返回 cookie' });
    return;
  }

  // 3. 用 cookie 查登录态拿 nickname / uid
  let nickname = '网易云音乐用户';
  let uid: number | undefined;
  try {
    const statusResult = await callNetease('login_status', { timestamp: Date.now() }, cookie);
    const profile = statusResult?.data?.profile;
    if (profile) {
      nickname = (profile.nickname as string) ?? nickname;
      uid = profile.userId as number | undefined;
    }
  } catch {
    // 查登录态失败不影响主流程,用默认 nickname
  }

  // 兜底:如果 login_status 拿不到 uid,从 cookie 里解析 MUSIC_U 字段
  if (!uid) {
    const musicU = cookie.match(/MUSIC_U=([0-9a-f]+)/)?.[1];
    if (musicU) {
      // MUSIC_U 是 hex 编码的 uid,转十进制
      uid = parseInt(musicU, 16);
    }
  }

  jsonBody(res, 200, { code: 803, cookie, nickname, uid });
});
