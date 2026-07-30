/**
 * 获取单首歌曲的播放地址(运行时按需调用)
 *
 * POST /api/netease/song-url  body: { id, cookie }
 *   id: 单个 neteaseId
 *
 * 返回: { url, isTrial }  — url 有时效(几小时),前端需缓存 + 过期重取
 *
 * 音质级联:standard → 试听片段(参考 fetch-song-urls.mts 第 207-243 行)
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const id = getField(req, 'id');
  const cookie = getField(req, 'cookie');

  if (!id) {
    jsonBody(res, 400, { error: '缺少 id 参数' });
    return;
  }

  // 尝试 standard 音质
  let url = '';
  let isTrial = false;

  try {
    const result = await callNetease('song_url_v1', {
      id: Number(id),
      level: 'standard',
      timestamp: Date.now(),
    }, cookie);

    const data = result?.data as Array<Record<string, unknown>> | undefined;
    const first = data?.[0];
    const rawUrl = first?.url as string | undefined;
    const size = first?.size as number | undefined;

    if (rawUrl) {
      url = rawUrl;
      // size < 500KB 判定为试听片段(参考 fetch-song-urls.mts 逻辑)
      isTrial = typeof size === 'number' && size < 500_000;
    }
  } catch {
    // song_url_v1 失败,尝试旧接口兜底
    try {
      const result = await callNetease('song_url', {
        id: Number(id),
        br: 320000,
        timestamp: Date.now(),
      }, cookie);
      const data = result?.data as Array<Record<string, unknown>> | undefined;
      const first = data?.[0];
      url = (first?.url as string) ?? '';
    } catch {
      // 两个接口都失败
    }
  }

  if (!url) {
    jsonBody(res, 200, { url: '', isTrial: false, message: '无法获取播放地址(可能需要 VIP 或已下架)' });
    return;
  }

  jsonBody(res, 200, { url, isTrial });
});
