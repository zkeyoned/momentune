/**
 * QQ 音乐音频代理 Serverless Function
 *
 * GET /api/qq/audio-proxy?url=<QQ 音乐 CDN 地址>
 *   绕过浏览器 CORS/ORB 限制,流式转发音频数据。
 *   Referer/UA 与 QQ 音乐官网一致。
 *
 * 行为与 /api/audio-proxy.ts(网易云代理)一致,仅改 Referer/UA。
 */

import { Readable } from 'node:stream';
import type { ServerResponse } from 'node:http';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { getField, type VercelReq, type VercelRes } from './_shared';

/** 音频代理专用 CORS 头(仅允许 GET/OPTIONS) */
function setAudioCors(res: VercelRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** 返回 JSON 错误(带 CORS) */
function jsonError(res: VercelRes, code: number, error: string): void {
  setAudioCors(res);
  res.status(code).json({ error });
}

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  // OPTIONS 预检
  if (req.method === 'OPTIONS') {
    setAudioCors(res);
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    jsonError(res, 405, 'Method not allowed, use GET');
    return;
  }

  const targetUrl = getField(req, 'url');
  if (!targetUrl) {
    jsonError(res, 400, 'missing url param');
    return;
  }

  // 请求上游(Referer/UA 与 QQ 音乐官网一致)
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        Referer: 'https://y.qq.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  } catch {
    jsonError(res, 502, 'upstream fetch failed');
    return;
  }

  if (upstream.status !== 200) {
    jsonError(res, upstream.status, `upstream returned ${upstream.status}`);
    return;
  }

  if (!upstream.body) {
    jsonError(res, 502, 'upstream empty body');
    return;
  }

  // 流式转发:设置响应头后 pipe 上游 body 到 res
  setAudioCors(res);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const contentType = upstream.headers.get('content-type');
  res.setHeader('Content-Type', contentType ?? 'audio/mpeg');

  // Node fetch 的 body 是 Web ReadableStream,需转成 Node Readable 再 pipe
  // 断言:运行时全局 ReadableStream 即 node:stream/web 的实现,
  // 但 lib.dom 与 @types/node 的类型声明不一致,需 unknown 中转
  const nodeStream = Readable.fromWeb(
    upstream.body as unknown as NodeReadableStream,
  );
  // 流式错误兜底(网络中断等,避免未捕获错误 crash 进程)
  nodeStream.on('error', () => {
    try {
      res.end();
    } catch {
      /* response already ended */
    }
  });
  nodeStream.pipe(res as unknown as ServerResponse);
}
