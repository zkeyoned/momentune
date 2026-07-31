/**
 * 汽水音乐 API Serverless Function 共享模块
 *
 * 提供常量、CORS、错误处理、cookie 提取等通用工具。
 * 直接移植 Mineradio-Tauri 仓库的 soda-qr-login.ts + soda-client.ts 实现。
 *
 * 端点对照(Mineradio → Momentune):
 *   get_qrcode      → /api/qishui/qr-create
 *   check_qrconnect → /api/qishui/qr-check
 *   me/playlist     → /api/qishui/playlist-list
 *   playlist/detail → /api/qishui/playlist-detail
 *   track_v2        → /api/qishui/song-url (内部两步取播放地址)
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 汽水音乐 API 公共参数 */
export const AID = 386088;
/** PC 客户端 User-Agent,与 Luna PC 一致 */
export const UA = 'LunaPC/3.5.1(408871041)';
/** 通用 Referer */
export const REFERER = 'https://api.qishui.com/';
/** API 基址 */
export const API_BASE = 'https://api.qishui.com';

/** 汽水音乐 API 配置(集中导出,方便调用方拼参) */
export const SODA_API_CONFIG = {
  AID,
  UA,
  REFERER,
  API_BASE,
} as const;

/**
 * get_qrcode 完整 URL(含 account_sdk_source_info / iid / version_code 等必需参数)
 *
 * 这些参数是汽水 API 反风控的硬性要求,缺失会返回 error_code=4031 "版本过低"。
 * 来源:Mineradio-Tauri soda-qr-login.ts 的 SODA_QR_CODE_URL 常量。
 * iid 是 PC 客户端固定设备 ID,version_code=3.5.1 对应 LunaPC UA。
 */
export const SODA_QR_CODE_URL =
  `${API_BASE}/passport/web/get_qrcode/?passport_jssdk_version=2.4.13` +
  `&passport_jssdk_type=normal&is_from_ttaccountsdk=1&aid=${AID}` +
  `&language=zh&next=${encodeURIComponent(API_BASE)}` +
  `&need_logo=false&need_short_url=false&is_new_login=1` +
  `&account_sdk_source=web` +
  `&account_sdk_source_info=7e276d64776172647760466a6b66707777606b667c273f3637292772606761776c736077273f63646976602927666d776a686061776c736077273f63646976602927766d60696961776c736077273f63646976602927756970626c6b76273f302927756077686c76766c6a6b76273f5e7e276b646860273f276b6a716c636c6664716c6a6b762729277671647160273f276277646b71606127785829276c6b6b60774d606c626d71273f32373529276c6b6b6077526c61716d273f3434353529276a707160774d606c626d71273f32373529276a70716077526c61716d273f34343535292776716a64776260567164717076273f7e276c6b61607d60614147273f7e276c6167273f276a676f6066712729276a75606b273f2763706b66716c6a6b2729276c6b61607d60614147273f276a676f6066712729274c41474e607c57646b6260273f2763706b66716c6a6b2729276a75606b4164716467647660273f27706b6160636c6b60612729276c7656646364776c273f636469766029276d6476436071666d273f6364697660782927696a66646956716a77646260273f7e276c76567075756a77714956716a77646260273f717770602927766c7f60273f363c3c31343c292772776c7160273f7177706078292776716a7764626054706a7164567164717076273f7e277076646260273f34303230313731292774706a7164273f37313637373334323335353529276c7655776c73647160273f6364697660787829277260676269273f7e2773606b616a77273f27426a6a626960254c6b662b252d4b534c414c442c27292777606b6160776077273f27444b424940252d4b534c414c4429254b534c414c44254260436a7766602557515d2530353235252d357d35353535374335312c25416c77606671364134342573765a305a352575765a305a35292541364134342c277829276b6a716c636c6664716c6a6b556077686c76766c6a6b273f276277646b716061272927756077636a7768646b6660273f7e27716c68604a776c626c6b273f34323d373c373c3137353c33312b322927707660614f564d606475566c7f60273f323737353535353529276b64736c6264716c6a6b516c686c6b62273f7e276160666a616061476a617c566c7f60273f37343c312927606b71777c517c7560273f276b64736c6264716c6a6b2729276c6b6c716c64716a77517c7560273f276b64736c6264716c6a6b2729276b646860273f276475753f2a2a7760766a70776660762a68646c6b2b647664772a68646c6b2b6d7168693a62696a6764695a666a6b636c62382032472037377076607741647164203737203644203737462036442030462030465076607776203046203046373034353520304620304644757541647164203046203046576a64686c6b62203046203046566a61644870766c662037372037462037376160736c66604c61203737203644203737303433353c3c33363437373d3c3d3d2037372037462037376c6b76716469694c612037372036442037373432373c3c33353d343033363433363320373720374620373768646c6b55776a6660767646776064716c6a6b516c686020373720364434323d373c373c3134313235352b3c3d3d2037462037376a76203737203644203737526c6b616a72762037372037462037376a765760696064766020373720364420373734352b352b373c303233203737203746203737666a6875707160774b646860203737203644203737465d5534572037372037462037376d7171754d6064616077762037372036442032472032412037462037377360776c637c517764666e4073606b712037372036446364697660203746203737666d646b6b60692037372036442037376a63636c666c6469203737203746203737636a6b71557760636c7d2037372036442037376475752036442037432037437760766a7077666076203743636a6b717620373720324127292777606b61607747696a666e6c6b62567164717076273f276b6a6b2867696a666e6c6b62272927766077736077516c686c6b62273f27272927627069605671647771273f276b6a6b602729276270696041707764716c6a6b273f276b6a6b602778782927776074706076715a6d6a7671273f277760766a7077666076272927776074706076715a7564716d6b646860273f272a68646c6b2b647664772a68646c6b2b6d71686927292767776a72766077273f7e2771273f27363d363137313c373c373d3234272927676c715a75776a716a666a69273f276364697660272927676c715a6d6069756077273f63646976607878` +
  `&iid=27960026095955&version_code=3.5.1&aid=${AID}`;

/**
 * check_qrconnect 完整 URL(与 SODA_QR_CODE_URL 同套反风控参数)
 *
 * 来源:Mineradio-Tauri soda-qr-login.ts 的 SODA_QR_CHECK_URL 常量。
 * 注意:此端点用 POST + application/x-www-form-urlencoded body,token 在 body 中传。
 */
export const SODA_QR_CHECK_URL =
  `${API_BASE}/passport/web/check_qrconnect/?passport_jssdk_version=2.4.13` +
  `&passport_jssdk_type=normal&is_from_ttaccountsdk=1&aid=${AID}` +
  `&language=zh&account_sdk_source=web` +
  `&account_sdk_source_info=7e276d64776172647760466a6b66707777606b667c273f3637292772606761776c736077273f63646976602927666d776a686061776c736077273f63646976602927766d60696961776c736077273f63646976602927756970626c6b76273f302927756077686c76766c6a6b76273f5e7e276b646860273f276b6a716c636c6664716c6a6b762729277671647160273f276277646b71606127785829276c6b6b60774d606c626d71273f32373529276c6b6b6077526c61716d273f3434353529276a707160774d606c626d71273f32373529276a70716077526c61716d273f34343535292776716a64776260567164717076273f7e276c6b61607d60614147273f7e276c6167273f276a676f6066712729276a75606b273f2763706b66716c6a6b2729276c6b61607d60614147273f276a676f6066712729274c41474e607c57646b6260273f2763706b66716c6a6b2729276a75606b4164716467647660273f27706b6160636c6b60612729276c7656646364776c273f636469766029276d6476436071666d273f6364697660782927696a66646956716a77646260273f7e276c76567075756a77714956716a77646260273f717770602927766c7f60273f363c3c31343c292772776c7160273f7177706078292776716a7764626054706a7164567164717076273f7e277076646260273f34303230313731292774706a7164273f37313637373334323335353529276c7655776c73647160273f6364697660787829277260676269273f7e2773606b616a77273f27426a6a626960254c6b662b252d4b534c414c442c27292777606b6160776077273f27444b424940252d4b534c414c4429254b534c414c44254260436a7766602557515d2530353235252d357d35353535374335312c25416c77606671364134342573765a305a352575765a305a35292541364134342c277829276b6a716c636c6664716c6a6b556077686c76766c6a6b273f276277646b716061272927756077636a7768646b6660273f7e27716c68604a776c626c6b273f34323d373c373c3137353c33312b322927707660614f564d606475566c7f60273f323737353535353529276b64736c6264716c6a6b516c686c6b62273f7e276160666a616061476a617c566c7f60273f37343c312927606b71777c517c7560273f276b64736c6264716c6a6b2729276c6b6c716c64716a77517c7560273f276b64736c6264716c6a6b2729276b646860273f276475753f2a2a7760766a70776660762a68646c6b2b647664772a68646c6b2b6d7168693a62696a6764695a666a6b636c62382032472037377076607741647164203737203644203737462036442030462030465076607776203046203046373034353520304620304644757541647164203046203046576a64686c6b62203046203046566a61644870766c662037372037462037376160736c66604c61203737203644203737303433353c3c33363437373d3c3d3d2037372037462037376c6b76716469694c612037372036442037373432373c3c33353d343033363433363320373720374620373768646c6b55776a6660767646776064716c6a6b516c686020373720364434323d373c373c3134313235352b3c3d3d2037462037376a76203737203644203737526c6b616a72762037372037462037376a765760696064766020373720364420373734352b352b373c303233203737203746203737666a6875707160774b646860203737203644203737465d5534572037372037462037376d7171754d6064616077762037372036442032472032412037462037377360776c637c517764666e4073606b712037372036446364697660203746203737666d646b6b60692037372036442037376a63636c666c6469203737203746203737636a6b71557760636c7d2037372036442037376475752036442037432037437760766a7077666076203743636a6b717620373720324127292777606b61607747696a666e6c6b62567164717076273f276b6a6b2867696a666e6c6b62272927766077736077516c686c6b62273f27272927627069605671647771273f276b6a6b602729276270696041707764716c6a6b273f276b6a6b602778782927776074706076715a6d6a7671273f277760766a7077666076272927776074706076715a7564716d6b646860273f272a68646c6b2b647664772a68646c6b2b6d71686927292767776a72766077273f7e2771273f27363d363137313c373c373d3234272927676c715a75776a716a666a69273f276364697660272927676c715a6d6069756077273f63646976607878` +
  `&iid=27960026095955&version_code=3.5.1&aid=${AID}`;

/** fetch 默认超时(ms) */
const DEFAULT_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// 类型
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

export type ApiHandler = (
  req: VercelReq,
  res: VercelRes,
) => Promise<void> | void;

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
export function getField<T = string>(
  req: VercelReq,
  key: string,
): T | undefined {
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
// fetch 包装(带超时 + 错误处理)
// ---------------------------------------------------------------------------

/**
 * 带超时的 fetch,默认 10s
 *
 * @throws 网络错误或超时
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// JSON / 字段解析工具
// ---------------------------------------------------------------------------

/** 安全读取 JSON body,失败时返回 undefined */
export async function readJsonBody(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    try {
      // json 解析失败,fallback 到 text(便于排错)
      await resp.text();
    } catch {
      /* ignore */
    }
    return undefined;
  }
}

/** 将任意值断言为对象,非对象返回 undefined */
export function asObj(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/** 安全读取字符串字段 */
export function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Cookie 提取(从 Set-Cookie 头)
// ---------------------------------------------------------------------------

/**
 * 从 Response 的 Set-Cookie 头提取 cookie 字符串
 *
 * 兼容两种方式:
 *   1. Headers.getSetCookie() — 较新 Node/浏览器 API,返回数组
 *   2. Headers.get('set-cookie') — fallback,可能是单条或逗号拼接的多条
 *
 * 每个 cookie 只取 `name=value` 部分(分号前的内容),用 `; ` 连接。
 * 返回拼接后的 cookie 字符串;若无任何 cookie 返回 undefined。
 */
export function cookieFromSetCookieHeaders(headers: Headers): string | undefined {
  let rawCookies: string[] = [];

  // 优先用 getSetCookie()
  if (typeof headers.getSetCookie === 'function') {
    try {
      const list = headers.getSetCookie();
      if (Array.isArray(list) && list.length > 0) {
        rawCookies = list;
      }
    } catch {
      /* getSetCookie 抛错时 fallback */
    }
  }

  // fallback:get('set-cookie')
  if (rawCookies.length === 0) {
    const raw = headers.get('set-cookie');
    if (raw) {
      // Node 的 fetch 实现里 get('set-cookie') 通常返回逗号拼接的字符串
      // 注意:cookie 内部本身不含逗号,可以安全 split
      rawCookies = raw.split(/,\s*(?=[^=]+=)/);
    }
  }

  if (rawCookies.length === 0) return undefined;

  // 每个 cookie 取 `name=value` 部分(分号前)
  const pairs = rawCookies
    .map((line) => line.split(';')[0]?.trim())
    .filter((s): s is string => typeof s === 'string' && s.length > 0 && s.includes('='));

  if (pairs.length === 0) return undefined;
  return pairs.join('; ');
}

/** 拼装请求汽水音乐 API 的标准 headers(可选 cookie) */
export function buildSodaHeaders(
  extra: { cookie?: string; contentType?: string } = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Referer: REFERER,
  };
  if (extra.contentType) {
    headers['content-type'] = extra.contentType;
  }
  if (extra.cookie) {
    headers.cookie = extra.cookie;
  }
  return headers;
}
