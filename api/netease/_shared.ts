/**
 * 网易云 API Serverless Function 共享模块
 *
 * 提供统一的 NeteaseCloudMusicApi 加载、CORS、错误处理。
 * 参考 scripts/fetch-song-urls.mts 的 createRequire 加载模式。
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// NeteaseCloudMusicApi 是 CommonJS 包,用 createRequire 加载
const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi');

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
// NeteaseCloudMusicApi 调用包装
// ---------------------------------------------------------------------------

/**
 * 调用网易云 API 的统一包装
 *
 * @param fn NeteaseCloudMusicApi 导出的函数名(如 'login_qr_key')
 * @param params 参数对象(不含 cookie)
 * @param cookie 登录 cookie(MUSIC_U=xxx 格式,可选)
 * @returns API 返回的 body
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callNetease<T = any>(
  fn: string,
  params: Record<string, unknown> = {},
  cookie?: string,
): Promise<T> {
  const apiFn = NeteaseCloudMusicApi[fn];
  if (typeof apiFn !== 'function') {
    throw new Error(`NeteaseCloudMusicApi.${fn} 不存在`);
  }
  const result = await apiFn({ ...params, cookie: cookie ?? '' });
  return (result?.body ?? result) as T;
}

// 导出常用 API 函数(方便直接引用)
export const {
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
  likelist,
  song_detail,
  song_url_v1,
  song_url,
} = NeteaseCloudMusicApi;
