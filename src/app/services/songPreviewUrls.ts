/**
 * 歌曲真实播放地址映射表
 *
 * 由 scripts/fetch-song-urls.mts 生成,请勿手动编辑。
 * 重新生成: npm run fetch:urls
 *
 * 说明:
 *   - 完整歌曲(isTrial=false):可完整播放
 *   - 试听片段(isTrial=true):约 30s-1min,标记后前端提示
 *   - 未收录的歌不在此表中,前端自动回退到模拟播放
 */

export interface SongPreview {
  /** 网易云歌曲数字 id */
  neteaseId: number;
  /** 播放地址(外域,audio 标签可直接播) */
  url: string;
  /** 是否为试听片段 */
  isTrial: boolean;
}

export const SONG_PREVIEW_URLS: Record<string, SongPreview> = {
  // 奔腾 - 周深 (网易云: 奔腾, id: 3391963877)
  'hot_benteng_zhoushen': { neteaseId: 3391963877, url: 'http://m801.music.126.net/20260711020803/5aa2f115384cb17b9391703daed83613/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80774101107/d32a/38a4/322d/91f355067cfec37da1a8f52991053670.mp3?vuutv=TxXMO5IoRFT12eAcJj3EXBlPKY28OoMlthtjTHPVU3x9LsTXcTHm2r4t3lZSxpWq3M0bjIlaURH4tfWnu3I1GWr8p5PjEahhNtgnUmXRfEo=', isTrial: false },
  // 一半一半 - Top Barry (网易云: 一半一半, id: 3333988321)
  'hot_yibanyiban_topbarry': { neteaseId: 3333988321, url: 'http://m701.music.126.net/20260711020805/36f17c1a490cc19a2e99fa2c7dc76661/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/77463889276/0696/c1ce/23df/cef0897f6d7e41867a22a2ab8e675e92.mp3?vuutv=EzzFSSAs3BMbmWCWehFGyECfKM+6FIc8SUkcEpP2fiqUi+RXd/062en8PCBhlvVGxndwyWqAaJBEcAp98r2KPbdL9DKVJQseU8qlCw7tJGE=', isTrial: false },
};
