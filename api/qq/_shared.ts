/**
 * QQ 音乐 API Serverless Function 共享模块
 *
 * 提供 QQ 互联扫码登录所需的常量、工具函数、CORS、错误处理。
 * 全部基于原生 fetch,无第三方依赖。
 * 参考 Mineradio-Tauri 的 qq-qr-login.ts 移植。
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** QQ 互联 APPID(ptlogin2 用) */
export const APPID = '716027609';
/** QQ 互联第三方应用 ID(graph.qq.com 用) */
export const PT_3RD_AID = '100497308';
/** QQ 互联 daid */
export const DAID = '383';
/** OAuth2.0 redirect_uri(y.qq.com) */
export const REDIRECT_URI = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/';

/** 生成二维码端点(ptqrshow) */
export const PTQRSHOW_URL = 'https://ssl.ptlogin2.qq.com/ptqrshow';
/** 轮询扫码状态端点(ptqrlogin) */
export const PTQRCHECK_URL = 'https://ssl.ptlogin2.qq.com/ptqrlogin';
/** OAuth2.0 authorize 端点 */
export const AUTHORIZE_URL = 'https://graph.qq.com/oauth2.0/authorize';
/** QQ 音乐统一接口端点 */
export const MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

/** 统一 User-Agent(模拟 Chrome) */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 默认请求超时(ms) */
export const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// 类型(与 netease/_shared 保持一致)
// ---------------------------------------------------------------------------

export type VercelReq = {
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | string[]>;
};

export type VercelRes = {
  status: (code: number) => { json: (data: unknown) => void; end: (data?: string) => void };
  setHeader: (name: string, value: string) => void;
  end: (data?: string) => void;
};

export type ApiHandler = (req: VercelReq, res: VercelRes) => Promise<void> | void;

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function setCors(res: VercelRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function jsonBody(res: VercelRes, code: number, data: unknown): void {
  setCors(res);
  res.status(code).json(data);
}

// ---------------------------------------------------------------------------
// 请求体解析
// ---------------------------------------------------------------------------

/** 从 req.body 或 req.query 中读取字段(body 优先) */
export function getField<T = string>(req: VercelReq, key: string): T | undefined {
  const fromBody = req.body?.[key];
  if (fromBody !== undefined) return fromBody as T;
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === 'string') return fromQuery as unknown as T;
  return undefined;
}

// ---------------------------------------------------------------------------
// 高阶函数:处理 OPTIONS / CORS / 错误兜底
// ---------------------------------------------------------------------------

export function handleRequest(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    // OPTIONS 预检
    if (req.method === 'OPTIONS') {
      setCors(res);
      res.status(204).end();
      return;
    }
    try {
      await handler(req, res);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown server error';
      jsonBody(res, 500, { error: message });
    }
  };
}

// ---------------------------------------------------------------------------
// QQ 互联工具函数
// ---------------------------------------------------------------------------

/** hash33 — 由 qrsig 计算 ptqrtoken */
export function hash33(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

/** 由 p_skey 计算 g_tk */
export function gtkFromPskey(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash += (hash << 5) + value.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

/** 默认 GUID(10 位随机数字字符串,用于 musicu.fcg 的 guid 参数) */
export function defaultGuid(): string {
  let guid = '';
  for (let i = 0; i < 10; i += 1) {
    guid += Math.floor(Math.random() * 10).toString();
  }
  return guid;
}

/** 解析 ptuiCB 回调文本,提取单引号内的字段 */
export function parsePtuiCallback(text: string): {
  code: number;
  redirectUrl: string;
  message: string;
} {
  const values = [...text.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
  return {
    code: Number(values[0] ?? NaN),
    redirectUrl: values[2] ?? '',
    message: values[4] ?? '',
  };
}

/** 把单个 Set-Cookie 头(合并字符串)拆成 name=value 列表 */
export function parseSetCookie(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(/,(?=\s*[^=;,]+=)/)
    .map((part) => part.split(';')[0]?.trim() ?? '')
    .filter((part) => part.includes('=') && part.split('=')[1]);
}

/** 把 Set-Cookie 头(字符串形式)合并到 cookie Map(同名覆盖) */
export function mergeCookies(cookies: Map<string, string>, header: string | null): void {
  for (const cookie of parseSetCookie(header)) {
    const [name] = cookie.split('=');
    if (name) cookies.set(name, cookie);
  }
}

/** 从 Response headers 提取 Set-Cookie 列表(优先用 undici 的 getSetCookie) */
export function extractSetCookies(headers: Headers): string[] {
  // undici (Node 18+) 提供 getSetCookie(),返回 string[];lib.dom.d.ts 无此方法
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') {
    return h.getSetCookie();
  }
  // 兜底:从合并字符串解析
  return parseSetCookie(headers.get('set-cookie'));
}

/** 把 Response headers 的 Set-Cookie 合并到 cookie Map */
export function mergeHeadersCookies(cookies: Map<string, string>, headers: Headers): void {
  for (const cookie of extractSetCookies(headers)) {
    const [name] = cookie.split('=');
    if (name) cookies.set(name, cookie);
  }
}

/** 把 cookie Map 拼成 Cookie 请求头字符串 */
export function cookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.values()).join('; ');
}

/** 从 cookie Map 取指定 name 的 value(Map 存的是 "name=value" 形式) */
export function getCookieValue(cookies: Map<string, string>, name: string): string {
  const pair = cookies.get(name);
  if (!pair) return '';
  const eqIdx = pair.indexOf('=');
  return eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
}

/** 把 Cookie 请求头字符串解析成 Map<name, "name=value"> */
export function parseCookieString(cookieStr: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieStr.split(';').map((s) => s.trim()).filter(Boolean)) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const name = part.slice(0, eqIdx);
      cookies.set(name, part);
    }
  }
  return cookies;
}

/** ArrayBuffer 转 base64(Vercel Node 环境用 Buffer) */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

// ---------------------------------------------------------------------------
// fetch 包装(带超时)
// ---------------------------------------------------------------------------

/** 带超时的 fetch(默认 10 秒,用 AbortController) */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// QQ 音乐 musicu.fcg 统一调用
// ---------------------------------------------------------------------------

/**
 * 调用 QQ 音乐 musicu.fcg 统一接口
 *
 * @param cookie 完整 cookie 字符串(含 p_skey 用于算 g_tk)
 * @param module 接口模块名
 * @param method 接口方法名
 * @param param 接口参数
 * @returns 接口返回的 req.data 部分(无则返回整个 body)
 */
export async function callMusicu(
  cookie: string,
  module: string,
  method: string,
  param: Record<string, unknown>,
): Promise<unknown> {
  // 从 cookie 提取 p_skey 算 g_tk
  const cookies = parseCookieString(cookie);
  const pskey = getCookieValue(cookies, 'p_skey');
  const gtk = pskey ? gtkFromPskey(pskey) : 0;

  const body = JSON.stringify({
    comm: { g_tk: gtk, platform: 'yqq', ct: 24, cv: 0 },
    req: { module, method, param },
  });

  const res = await fetchWithTimeout(MUSICU_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`musicu.fcg 请求失败: ${res.status}`);
  }

  const json = (await res.json()) as { req?: { data?: unknown } };
  return json?.req?.data ?? json;
}
