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
  'hot_benteng_zhoushen': { neteaseId: 3391963877, url: 'http://m701.music.126.net/20260711083832/ddd260b7fdad97dd246ce50ed03aa674/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80774101107/d32a/38a4/322d/91f355067cfec37da1a8f52991053670.mp3?vuutv=dy/Jx+CzjoVG6XBzBWI6Dys4cqE5mLRj0Y2oJnLZidyKsBrPCgo5kWcPJ3MSiSgm9NMDLUIXQ51FG/qCxoq0YTq3QytXrwGChHMjrFLLwcg=', isTrial: false },
  // 一半一半 - Top Barry (网易云: 一半一半, id: 3333988321)
  'hot_yibanyiban_topbarry': { neteaseId: 3333988321, url: 'http://m701.music.126.net/20260711083833/e79aa78d278590ad38a4684bc97d534d/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/77463889276/0696/c1ce/23df/cef0897f6d7e41867a22a2ab8e675e92.mp3?vuutv=vpBmIznJRA9C+UENjKQ0Ixn3Al66uBIDh/QuM3onWl+cSlhcxuvslSobsN/E8Le9Gok6DAF/2fGp2AD7EGuNAlQhkSi3+pB3A7dwLyuFHVA=', isTrial: false },
  // 龙耀华夏 - 龙友林 (网易云: 龙耀华夏, id: 3378112467)
  'hot_longyaohuaxia_longyoulin': { neteaseId: 3378112467, url: 'http://m801.music.126.net/20260711083838/3718d44b226df41d4517e167901adbc1/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80812548058/a46a/409b/2408/a9259fcc6cf2f9a0064af5582cce8966.mp3?vuutv=yc+rMw8i6TKXjGwfpKTJHrQGLkLWDHkdFA5rfcxHgxJZEjDUBgHRVTQxeAMj3eeEOsi8l2Ib5/fUkx/VEi9lt3InHjmMC832rE3NSFk1E9g=', isTrial: false },
  // 顺其自然 - 国产阿发 (网易云: 顺其自然, id: 3396264200)
  'hot_shunqiziran_guochanafa': { neteaseId: 3396264200, url: 'http://m701.music.126.net/20260711083848/74117aacf2083baa57c88547b1d86c7c/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81024167138/2cd7/8ec6/45a2/8962877000ba1b0ea4d72480367f1659.mp3?vuutv=r0uBuxKcgBjZwwoqZQq6K2b+dSVFSksfTDTXJnRQjlLJxdpUz7oY8cDdocqxwNPjoU9131raL2Gzbu1EMJVOKtEpR5xYQGxUiWrG4wSfiR4=', isTrial: false },
  // 那天下雨了 - 周杰伦 (网易云: 那天下雨了, id: 3357694189)
  'hot_natianxiayule_zhoujielun': { neteaseId: 3357694189, url: 'http://m801.music.126.net/20260711083850/39f1632c675ea9737cd5bd5bbd824c05/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/78908351911/e873/7f39/cd22/4f16aaff3e38fd804f316f0a5f64404a.mp3?vuutv=LByl892Anp97NVGkbp91jseCSL7z9yZM+DDddnrX0U/4A9pmTS4Dvm5H3mEfTlS67ko8MybCrLgwbIsflZBTM5OYHBQthYI6ZORXvelfMOw=', isTrial: false },
  // 解脱 - 郑润泽 (网易云: 解脱, id: 1897016511)
  'hot_jietuo_zhengrunze': { neteaseId: 1897016511, url: 'http://m7.music.126.net/20260711083851/d82b73002b21e1d910d141c5b25e302b/ymusic/obj/w5zDlMODwrDDiGjCn8Ky/14052704708/164e/4d8b/7e69/6db9f93e28117aa00dfb707a97bf0bba.mp3?vuutv=0Ub7UbGRIHQDrSfoZkgwVeGmF9fvY84sw6CJSnFdoFg/uhfhcofRV1m8lI3HcmkWk4CGhygGoIfK3wSiPDNn5tbA+kdrzmL5yZ+inz7pWqI=', isTrial: false },
  // 锈 - 江辰 (网易云: 锈 (我们两个都拉过勾), id: 2648204040)
  'hot_xiu_jiangchen': { neteaseId: 2648204040, url: 'http://m701.music.126.net/20260711083853/0a025fba8ea028dbd3305f7fd9f735b2/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/56885242884/d503/96fb/0602/7b9336620d39a1e6a3e05d4814cc4b1c.mp3?vuutv=csCaB+5BdYLdaaRpZ37wTv0OTtpee677c8+jDdSl5CAyNo0eSUgEkKu0h9Z93mFUwqIS12b1bPd3FkLODg6DAQ+BJSsUqgZLcvHxRZG0QUY=', isTrial: false },
  // 梦哑 - 任然 (网易云: 梦哑, id: 3387477661)
  'hot_mengya_renran': { neteaseId: 3387477661, url: 'http://m801.music.126.net/20260711083854/918580201438f2ec4a62bbbe3401aff9/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80529257691/505e/dc9a/9865/be7de53347fe213a5e2e5d2ed20f10d3.mp3?vuutv=Y3vodHSwZszrdBK47hL48x5zTZYkCRVL/DVECQe67otE3XFvW7uu0bvt54sSXWAqQ+2XnX2cZEh3kLSA/c87H4zf018x3tVhbSSEw+Dkheo=', isTrial: false },
  // 非凡 - 刘德华 (网易云: 非凡, id: 3332722182)
  'hot_feifan_liudehua': { neteaseId: 3332722182, url: 'http://m801.music.126.net/20260711083856/cc673bc5d86ac0c8fc0fadc924d7e03e/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/77383503758/f386/91eb/3d73/786f8cd935c86df050ba3d425bfccd90.mp3?vuutv=2iNtdA+p0yKDY7pkouQZ1gmxdHQxyNG/48v8sGw0CGW+puJ53LAcb79R8+AyTk6A9XRSmMZ3EyCH1nh7qBYOwy7wr9RcjHRtiHtYe2zG/Wg=', isTrial: false },
  // 玻璃 - Gareth.T (网易云: 玻璃, id: 3382908505)
  'hot_boli_garetht': { neteaseId: 3382908505, url: 'http://m701.music.126.net/20260711083858/c0ecd213388e7aa3bcc9ebb00a5fbe2e/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80273712118/61bf/c245/f9e6/4e472334096fa869e1dfc322d708a853.mp3?vuutv=9xguOJNn1lpR/XKxr7SS24xmUGW/3NP+BqlPOt4jiNWnLiiiR8k5bs7BNJyxKZ0ZZDS9M+siy3MPkZfqO85InbsfzCjvqh7FdWm3mkPg/cE=', isTrial: false },
  // 槍火 - 宝石Gem (网易云: 枪火, id: 3326404841)
  'hot_qianghuo_baoshiGem': { neteaseId: 3326404841, url: 'http://m801.music.126.net/20260711083900/2164e9552070e2ba5b04605ebd7171ea/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/77029674422/49ff/f3ab/0519/665ad100e6715456cc844f954c707f23.mp3?vuutv=JtQ5tj7S2QBYdXKOh+rcc4UwD+qn+hT7JBZfoiuZ41t0gg8PPt24uCpY6IsssFwKQr9qC1SybpaYpiMa1A00kYnRAdPmw+k02PNqDVyIxRo=', isTrial: false },
  // 山歌王 - 功夫胖/GAI周延 (网易云: 山歌王, id: 3349945534)
  'hot_shangewang_gongfupanggai': { neteaseId: 3349945534, url: 'http://m701.music.126.net/20260711083902/524966c1d89feaf1f9f42d1b494f1d8b/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/78403931748/5d06/1736/e4b6/f07eadbea5a457277b7077c52446af31.mp3?vuutv=apWXWmTACPmSFEsD9yUHGw0ERiDzLHT/RrrPoNaOhvOl2eLjRufMlreilJUc5uBs8eH8XgftB2ARrNp7OTyhq9lpF4u6iS5FcKe51gT+VGg=', isTrial: false },
  // My Way(由我) - 严浩翔/谢帝/盛宇 (网易云: My Way, id: 3396631091)
  'hot_myway_yanhaoxiangxieyishengyu': { neteaseId: 3396631091, url: 'http://m801.music.126.net/20260711083903/37fc7a78e86565c18070949f46e96396/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81086631268/acf8/1be6/4ac7/3d430dbb21691a8cdc3093f033899147.mp3?vuutv=c8VPEjruVF88T5MdAxfsBd01P06mFiSVUx30Drmuj6RrlsALkj+ASC3am9r11ktCiICfEpM25GRta7LFuMuRoZ96Ija1dbDt9CfEoOTwRMw=', isTrial: false },
  // DD backseat - Top Barry/Rapeter (网易云: DD backseat, id: 3362321946)
  'hot_ddbackseat_topbarryrapeter': { neteaseId: 3362321946, url: 'http://m801.music.126.net/20260711083905/c4a07da2ee2b7145f998020190d946f7/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/79209196050/67a3/6fe1/111e/09a00e34a7f89e3873479daf1f200dcd.mp3?vuutv=R0y49+JJ/YFHeannwG6FGZPn5uXKo71Hr2CQKke3v8u7lMxUc4Z7TVEaDG29Xc0TPgo4KYVBIlJmZdZulaoXoVXP6cT0ElVa4rcwIMIomqg=', isTrial: false },
  // 背叛 NEED<3 - CashTrippy (网易云: 背叛 NEED<3, id: 3374011915)
  'hot_beipanneed_cashtrippy': { neteaseId: 3374011915, url: 'http://m701.music.126.net/20260711083907/1d33c55719b6fec09b88cf43b5a951e4/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/79786058865/3a70/85f9/512b/a21525806a56c2dec66867cca07d19b1.mp3?vuutv=M/rqM743Kf6QnMQGfu9qJuWpkPCX/gwc4VghZXh3ADo6+KdZKO/6JMGTHDePSLlHnJx2K7WRa96cHR+qVR2E0uec+GOiuXn6Z2smHDv8ASg=', isTrial: false },
  // 排尾后巷 - 万妮达 (网易云: 排尾后巷, id: 3373360561)
  'hot_paiweihouxiang_wannida': { neteaseId: 3373360561, url: 'http://m701.music.126.net/20260711083908/8a99de3319d2fd4cb8131dc3a5dc423d/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/79754330043/3597/f2ed/3fb2/473c1eeb80f493f43de2f8e14024c978.mp3?vuutv=FiEq+gpje1gDfsI2x02LuvcDGyWC0lo6KkwLlO7GC111wfRgO3Y7goufLFgAc+Qql/1fij8JHxhk7ap5iCKWoP9/NYFlexiKicgXGAX0UC0=', isTrial: false },
  // 反乌托邦(拼接版) - Ciyo (网易云: 拼接乌托邦, id: 3379996850)
  'hot_fantowupinjieban_ciyo': { neteaseId: 3379996850, url: 'http://m701.music.126.net/20260711083911/9c66a28e6bf2c81acd035764df024ff6/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80115910180/fdb5/cca5/c9c9/945ded3682c4cc6c496c7ee5ddc927f1.mp3?vuutv=lGabTfRXCXF96EVpoPwH4+VpWW5koBHq/L46Tln2msSGwjJolUbPkm3VIMG1kpcfDLmu/DCUC0tOBbKiaAD8EfGH+flkCGPNvyApg5Su7xo=', isTrial: false },
  // 小河淌水(2026雷击顿) - YKKKK马丹阳 (网易云: 小河淌水（2026雷击顿）, id: 3398369607)
  'hot_xiaohetangshui2026leijidun_ykkkk': { neteaseId: 3398369607, url: 'http://m801.music.126.net/20260711083913/1fa7db9270bd946f3351a165e0b9e3a2/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81190624291/78a3/d86d/d93a/e856edeedb22477233f25d05986ae511.mp3?vuutv=lsOLuLiK6foX/vZm9DYRGAgBJgR+HwRL7xiE0dQDama4tmkeZDtIO27AYrn2R0E3qV+k92wps2PWujKmNuOjv85oo9om9R3wUMv/RSuhy8U=', isTrial: false },
  // 你爱着谁Remix - moonlight (网易云: 你爱着谁Remix, id: 3379175125)
  'hot_niaizheshuiremix_moonlight': { neteaseId: 3379175125, url: 'http://m701.music.126.net/20260711083914/1201aa02ef6c60ee4ffb07d23156561e/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80093705470/fbeb/1366/8187/c2cc51ffbec842b61817bd8a136a1b8e.mp3?vuutv=K5zudPRaaEm5feuf2bt9SCCTbMiOeCzX7Y8yC0vnK1pVijyomzmIw+py8vuaX1knT5azEbgX5sdbF9dOBkwefO0SnMKq26GmeK5pRKRYvs8=', isTrial: false },
  // 写故事的人 - 汪苏泷 (网易云: 写故事的人, id: 3397522404)
  'hot_xiegushideren_wangsulong': { neteaseId: 3397522404, url: 'http://m801.music.126.net/20260711083922/6aa8a9e0c71f02e1b07e8c8f4b88508b/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81087851812/d056/8209/cbc3/2fd0cd485197bd6130e53cb66ed62a5e.mp3?vuutv=oHL6e3sL/I2uO25yl+e038ocIfCAIsPwuKI1W0nYUDHKszM2izsaTXEK38d3xm1GmWHVTFP4XNmrMywbZvypw6I4QlFMvGZitfDF0+bXw6k=', isTrial: false },
  // 不遗憾 - 李荣浩 (网易云: 不遗憾, id: 3324404006)
  'emo_buyihan_lironghao': { neteaseId: 3324404006, url: 'http://m801.music.126.net/20260711083923/aa6b1f85bee9716cad02dc69f2b5263f/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/76896394293/d156/0a7c/988b/ba27c90a6b67e730f7a98246bc16e98e.mp3?vuutv=q7lPlxHzt6xFddEFF3OqHV3nnXr13ySqQOwpAgjATZsrUYxi29eZFTD9nvT12i7IsydiifRoTzKt70cl7GEkJEv7BHzeT/PeuX0lKF0LyNI=', isTrial: false },
  // 消愁 - 毛不易 (网易云: 消愁, id: 569200213)
  'emo_xiaochao_maobuyi': { neteaseId: 569200213, url: 'http://m701.music.126.net/20260711083927/c793d06e2b83e6dfafa0f2336fcd36d3/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/28481681687/2130/f1e0/fbb1/d701c960711e73b85d91fc8b62d9b452.mp3?vuutv=bCfdMyRrO3CwfvgN6ZHPRR06nHk/C1aLgHDM5MZ9p0hrNJvfKv2OgyG8R8y8NZxVbVfKEXDDpXc3CPxBVBeiI25Prsp/OkYs4gDqhmaBFuM=', isTrial: false },
  // 陪你度过漫长岁月 - 陈奕迅 (网易云: 陪你度过漫长岁月, id: 35403523)
  'emo_peniduguomanchangsuiyue_chenyixun': { neteaseId: 35403523, url: 'http://m801.music.126.net/20260711083930/86c1f93f6130daa3d1332ca248be7a32/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/14096496150/6998/1b51/f0e1/e42c83e1710ac75a1e4451f0fd7948bb.mp3?vuutv=uc6q9YGRVpKwdMwNy8AIPJTJzQurgXRjAso1BHER9UE8nCf1VsWPe5gTe1+r9OlUXdrXTGoKXhfPg0Q5v1vLJAHeaPJq6DOtZ4Bc8YgrBvw=', isTrial: false },
  // 野草与栀子花 - 林三七 (网易云: 野草与栀子花, id: 3391971728)
  'emo_yecaoyuzhizihua_linsanqi': { neteaseId: 3391971728, url: 'http://m801.music.126.net/20260711083935/add591c866ab86e460f37f7f437febd5/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80774330567/64f1/c56d/8b5a/4c144fe6b1285884641bb99c280c00ed.mp3?vuutv=zdBN16Wqoq1NhYiB9d0t5ojhZ3eIYotWRZcmd/+SkwHjaXKmON/Awb1/QgV9B6ns+xn5PjeqwL2OmQH1yUtKese2zr8vOsIuwLUC6pbgxxk=', isTrial: false },
  // 向云端 - 小霞/海洋Bo (网易云: 向云端, id: 2049512697)
  'emo_xiangyunduan_xiaoxiaohaiyangBo': { neteaseId: 2049512697, url: 'http://m801.music.126.net/20260711083939/304fc933c67d29c1b5a8d0ad097f56b1/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/28133411236/dacd/1bb8/5f73/7b7bfa83f3783efac4dd8e56e627a33e.mp3?vuutv=u/o3adLOHlvRs76PN9fWkrbbJjx23MtgJgkTt299l7IcE+h305Myosn03+x219gWiHoA4EkfRgvU8/oV7b8UvWAB9hAKJEQGGXH6+cFwaQY=', isTrial: false },
  // 潜到海底说爱你 - 万妮达 (网易云: 潜到海底说爱你, id: 3385918396)
  'emo_qiandaohaidishuoaini_wannida': { neteaseId: 3385918396, url: 'http://m801.music.126.net/20260711083959/ec5ec70f4ce94efc0bcbbf2bfbd1a0d7/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80479953845/3387/ac5b/52dd/64ec42923aa3b6072199efcf91ad1a5d.mp3?vuutv=zsPWAko3WTzRpYwu1nNuFqFrdJrLUxk88nO8JSECF0Yn8How+a9p8MvieMFrPZE8oPbbNQuwvO4IX8ZsQw6Enet45gzcBaOFA4KVBISmKRc=', isTrial: false },
  // 包头也有草原 - 黄涛 (网易云: 回到自己, id: 1356313292)
  'emo_baotouyoucaoyuan_huangtao': { neteaseId: 1356313292, url: 'http://m8.music.126.net/20260711084001/b544e0e67ceed550048d70c17dd2c9e0/ymusic/550b/535f/015e/ba5c75c2f1d50dbb7c7f648e9200d7dd.mp3?vuutv=3UPpipsgtP56E1+LlJR6QY8oqnUqkglc4hUaTOiSKrd4agn/7Vbk7RVK4C91sCTK0Ww8PvJd0OUF6TkcHTSkM1qwCpsE/Gtb57L524TwjBA=', isTrial: false },
  // 胡辣汤之歌 - 东河乐队 (网易云: 我把故乡弄丢了, id: 3398801920)
  'emo_hulatangzhige_dongheband': { neteaseId: 3398801920, url: 'http://m701.music.126.net/20260711084003/85b37f717470624936eab4d8494c6290/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81151908017/a770/855b/8688/abf26e2a322a5aaf5e6f87165727858a.mp3?vuutv=4J1Mpm7EKrVjI5wfCoqTbMdPjD4G8WK/y4APBsHq/kHyrCmNdJKati6iqMBSvEMX2+HDYEbIKxjhL9L/TTX5WYY0tlxBxEBtYKnWsIu393k=', isTrial: false },
  // 让你知道 - 汪苏泷/G.E.M.邓紫棋 (网易云: A.I.N.Y. 爱你, id: 234015)
  'hot_rangnizhidao_wangsulong_gem': { neteaseId: 234015, url: 'http://m7.music.126.net/20260711084016/5e678b71da2f1ab3f30ecf11a42f79a2/ymusic/1b68/dbb2/b2de/6e4b08c242e0eaa86a6c0d219148a657.mp3?vuutv=fBqt3obIjelInzlZcylh884aknU+KYKl7DBUs75MhY/0er2vua9pgM4kqv4d9B8+A2X0CViX49QXGNJRaliNF9VL/5s8wSJ2WPhE1G1kr6g=', isTrial: false },
  // 街角的晚风 - 陈小春 (网易云: 街角的晚风（原唱）, id: 3400509270)
  'hot_jiejiaodewanfeng_chenxiaochun': { neteaseId: 3400509270, url: 'http://m801.music.126.net/20260711084017/f550e1eafba18d0355e4b9a4754866d1/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81245103109/9ec1/76ce/20e1/326f6113cf2bacc3e914d4f1836e4542.mp3?vuutv=ORagFNJZhqIYSdTVpXlpIwrhJkEO1tRZyXQzs6udIkNLa3Bo52fZFkL8unkOEQMc4jmrQmxcLyQdSXvdfyhCyqxxOGU2wOMIPfKzXbvxdlY=', isTrial: false },
  // 签名笔 (Live) - Rapeter (网易云: 签名笔 (Live), id: 3398659389)
  'hot_qianmingbi_rapeter': { neteaseId: 3398659389, url: 'http://m701.music.126.net/20260711084022/5e0c86d4aff056a4282451cd9af5585a/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81146078301/89a0/8f87/de51/0e4dbe193d66635c60bd514a27b521f5.mp3?vuutv=trBa2gcfm7HPY9VAxhcCDDqhn4k2OoW3TzyQB3Yca7eybvgVYpfl7z2qJOrn+hOjX459OEVz2yV3CmwQAkt7gO/BnJNIEVS+YzXJ574DKM4=', isTrial: false },
  // 浓缩蓝鲸 - 裘德 (网易云: 浓缩蓝鲸, id: 1864619253)
  'hot_nongsuolanjing_qiude': { neteaseId: 1864619253, url: 'http://m801.music.126.net/20260711084023/ff7969b4ffc1c6dbee59cb6f384f6e4c/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/12236182860/2105/e072/2903/9d3cfab0119dd18d588d06ba2af782c5.mp3?vuutv=5oeHfdtlIcxvRmKzP4vVkkLrztt6owKRQm+DMlJhkdG57IHjRbhL0rBnnNYbDlkOCRlES4POTaT0WyM4mgIAMRMNdHDYxh3UbvZ3Lxaen4c=', isTrial: false },
  // 坠落 (Live) - 孙楠/黄子弘凡 (网易云: 坠落 (Live版), id: 3398249712)
  'hot_zhuiluo_sunnan_huangzihongfan': { neteaseId: 3398249712, url: 'http://m801.music.126.net/20260711084025/9be041301846dedde92349b9b4210559/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81125889271/8275/be9d/a550/4daa03034f50ca4b64fb97dc4868d33b.mp3?vuutv=yr5AmCGtJII/icPkxRzE+TgBBuNWEVZbxrNPq1s6poIJNqQDy4NKiuGWYfUXiYXOeyoQCNkbzXfomMzaoaoMncnbyhSuj/UwmOl9zpQEtNY=', isTrial: false },
  // 甜敌 - 希林娜依高 (网易云: 真爱万岁, id: 2060775002)
  'hot_tiandi_xilinnayigao': { neteaseId: 2060775002, url: 'http://m801.music.126.net/20260711084027/1917400c5ce5468ff6be3d10f70f2f98/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/29425128054/fe50/e027/ec95/5942aaa3bd50f9f10ca335dc29650431.mp3?vuutv=ZVTFF4B70b6rdOAKdI9qN7jI/sL9qJ3NDjOIYmxf8G2CBk2igJe4zRsiG+Z2jUORE7GRPrlbLUvtQ0cWWnKfwy4z1f4fAste9gqWndtp/Kw=', isTrial: false },
  // Colt.45 - 弹壳Danko (网易云: Colt.45, id: 1499560899)
  'hot_colt45_dankodanko': { neteaseId: 1499560899, url: 'http://m701.music.126.net/20260711084029/0f8388e030f36ffbe5bf570aa72e6236/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/32047754610/8bf9/a329/c6f2/ab01860a17346c3730af0cceb1eeb218.mp3?vuutv=u7x0ZDtTHafUx5UUSvhZDgWEk6OBBB75kQrNthzmfd8hqJ5rJe/tE3dU107JbdMjKqb2qcNfs82GoWuZuPy2cDXW5fpsaj+R8STGwxszp/8=', isTrial: false },
  // 洛阳纸 - 许嵩 (网易云: 洛阳纸, id: 3394036706)
  'hot_luoyangzhi_xusong': { neteaseId: 3394036706, url: 'http://m801.music.126.net/20260711084032/55333fb6de0f52c205eaf885ec6e3024/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80893708986/ce0c/d74b/eda3/1a6423c89f69c3290b38e9a88d244316.mp3?vuutv=o+Z2geHYcUT1lDv7mW3QcHaxC/ItRE2I/aU3hMT9teHWM1vl4wWjDosxjes73qbzDTXdBSo4IK0q4roGdkLWI8EKW+c0Z7tsZ+emtfCwA78=', isTrial: false },
  // 赤子 - 周深 (网易云: 复刻回忆, id: 3397439300)
  'hot_chizi_zhoushen': { neteaseId: 3397439300, url: 'http://m701.music.126.net/20260711084036/2a69ca2a88dbcb27d0e48d8e40dad174/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81085003074/a4f1/37b5/18a5/1e0bf9f600aecb501cd2b0c29d9379e8.mp3?vuutv=7N745DUYuhFjCsKs95e3BaBUTrU3dI60YaWis6Pm9rWXhClv09FTXLgdEljmf16kzsMBVfDvN6nMLt9TfKR8mPoHgduZWFNkcFlIJcSSEgs=', isTrial: false },
  // 紫钗缘 - 张云雷 (网易云: 紫钗缘, id: 3390215233)
  'hot_zichaiyuan_zhangyunlei': { neteaseId: 3390215233, url: 'http://m801.music.126.net/20260711084037/c47c76182f8ec4d2630c314e2fe1abdf/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80740723262/df27/085b/3569/136ffc8f3f2ff6888f8f141fbe48e9ef.mp3?vuutv=TQj1Qs6srEYQw4U8D3ZnOFtzaDFgvjtgeZsPogfRTLuT2z2R9XtMuCBLiUf+LixDxxnlGdCGL2WIn5yWMyX6rEvRWq0RnB4Yvtkojys6YK4=', isTrial: false },
  // 粗糙 - 许嵩 (网易云: 粗糙, id: 3394038575)
  'hot_cucao_xusong': { neteaseId: 3394038575, url: 'http://m801.music.126.net/20260711084039/360b0d5c8f5d6d1fc3840667e348d822/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80893703981/5eb0/d718/289d/76ee7ce560dcb7d3f20609d9e26c7788.mp3?vuutv=V7STY2tG/PXng90Ts+YF+mIhyRExXUns9pPzTJKQMu93meCDHhlyAzJoUdOhDYuTaEqRZ+clCuuo+48kBtZ9OOyIT3zyZZ8vTkv6PnAgOlI=', isTrial: false },
  // Alive - 王嘉尔/阿信 (网易云: Alive, id: 3386660204)
  'hot_alive_wangjiaer_ashin': { neteaseId: 3386660204, url: 'http://m701.music.126.net/20260711084040/7787c8bf9cfbab580f736272b1e6c8d7/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80485278466/8d56/14e5/d01c/e2b56f05a4cba1ef4d779e8ccf4c74e1.mp3?vuutv=+Fwc57Qjr+2QQ9qu0CYpQeep77+tVdVgxfGUhOMpBq0CpCn4LzarT6lAt2F03dor5igPi0LV+9JjAAwK4y0ZdVakdYELz1GhzCP/qwpSnao=', isTrial: false },
  // 怎么能 - 侯明昊 (网易云: 怎么能 (2026属于我们的巡回演唱会南京站), id: 3384819179)
  'hot_zenme_houminghao': { neteaseId: 3384819179, url: 'http://m701.music.126.net/20260711084041/0e01cf9ff15f3abefbadcfc7280e9b0a/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80324503987/f2fd/7517/8718/85d7438b5214e46b5725cada9c455e8d.mp3?vuutv=ED957erVbKLuMb35f9irae4aN5lCDXZFFOU9di5QC+bfjwwgPCVfqC/9IYLCvYBEvhNEdmJruj/Jc18J+X41tYfu/c8kRtDUAf+4B+8XlT0=', isTrial: false },
  // Janice STFU - Drake (网易云: Janice STFU, id: 3382154258)
  'hot_janicestfu_drake': { neteaseId: 3382154258, url: 'http://m801.music.126.net/20260711084045/40a0477c9705c2dacaaa3f366ce83f5b/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80414544719/a9fc/a24c/87fe/81e4f3ec2017467cc9061b838661133a.mp3?vuutv=FYIE6EYNE6zr5SdhEJU122UV+rINdjQIxhpDBdt2HI8ChP+V5Y/Uv2AIn8kfiwbU+oIy0TW7qNJw4ufI1G3qBVyNsFjYqR67hKTiUOREJ+4=', isTrial: false },
  // The Cure - Olivia Rodrigo (网易云: the cure, id: 3384746574)
  'hot_thecure_oliviarodrigo': { neteaseId: 3384746574, url: 'http://m701.music.126.net/20260711084046/514f6dc8b7607057ee91fc122320ba19/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80370526437/a34c/4265/5d47/67eb1857687bd122697f71660e2a7fc9.mp3?vuutv=KzgN0MhYtkrv9Ec1zg0fsW7P5P82vSm/aW6N4dHusNRzmVRaWeLguw/T8UhAiYKjO39BmJM8Ag0j0myKZ1pJF8v2dj7gkVkyWns9PnCA+ug=', isTrial: false },
  // Drop Dead - Olivia Rodrigo (网易云: drop dead, id: 3370511577)
  'hot_dropdead_oliviarodrigo': { neteaseId: 3370511577, url: 'http://m701.music.126.net/20260711084047/a3c5df26243901b398e5b9a07ec5ebb2/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/79707433514/4704/4038/23d7/0e09d07939591eeb491e953309d6c312.mp3?vuutv=jLkZHk5yj8lqZfaILvioRPaRwxVUnQAeTzCIAVVeSKQSazHSVB/K7Zj33Rv+rTmT9/P/M+nTP3w/1SAH5leHmvH4i2Qieu0tL0iVI1X7O5I=', isTrial: false },
  // Hate That I Made You Love Me - Ariana Grande (网易云: hate that i made you love me, id: 3387362820)
  'hot_hatethatimadeyou_arianagrande': { neteaseId: 3387362820, url: 'http://m701.music.126.net/20260711084051/9d25482edc850cabd9bd41c7018f42b7/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81119201673/244a/d492/0cdf/0f2bced775f7cceaa7b3ce7a96f138ce.mp3?vuutv=t9hnXp5vuzPwtXsMe/hEZ8mFhI4NKOeaFBNYiO64bWpG6Dvu7cQN4mynting3SAQY+/Nu24Aa5s003S00LAX4l25VibbERs9Y/l3vJKmaAs=', isTrial: false },
  // stupid song - Olivia Rodrigo (网易云: stupid song, id: 3392742809)
  'hot_stupidsong_oliviarodrigo': { neteaseId: 3392742809, url: 'http://m801.music.126.net/20260711084054/41330041156ec7141a068869c6a5d307/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80819184560/634b/7424/384f/540736f7669a8062a44a4b39b9bbc332.mp3?vuutv=f5UrsC8tM0XkhGbTJEVdH6ktD+ol4ry1w15jnpmh1/4nMkWy3A5I/uvwx74pa6hLm25RBqaE4THq8JVeFn3bG+CWqyqQr4D05ch6NeaJzfw=', isTrial: false },
  // 三月 (live) - 尤长靖 (网易云: 三月 (live), id: 3398248525)
  'emo_sanyuelive_youchangjing': { neteaseId: 3398248525, url: 'http://m701.music.126.net/20260711084109/a5df12abb219b0c7cdc76964cc502e1e/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/81134978043/eb49/213b/fd01/10d37bd2aa76e45568bd6cb160182599.mp3?vuutv=7A82PlimlPG82C7SsawmS6grlRpozFuCGaObm2WK6wHa6tgu0kFPCMJU9lBLMM2Yhofw9vdPXeJXQTdDo8cg4a+LEMgvVxqnUvrbZZj782o=', isTrial: false },
  // Brand New Sky - 鸣潮先约电台/飞行雪绒 (网易云: Brand New Sky (新世界的天空), id: 3395393730)
  'emo_brandnewsky_mingchao': { neteaseId: 3395393730, url: 'http://m801.music.126.net/20260711084118/0d4eb4868802c3ba8cb864ed965667e3/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80978688257/64db/f60f/5440/575be3eb99863f649eaf06d17ef0508b.mp3?vuutv=G6/FHgtq9yeceJQxynw+bP+kvoOCUtSgGCeY2QyV6T3hhIPR6sZ/n8h4j8l61p16Thw5APAGRSFxYd/iKpnA490VtjZqGdbWCe5TAxHhn60=', isTrial: false },
  // 烏 - Raven - 米津玄師 (网易云: 烏 - Raven, id: 3388574657)
  'emo_wu_yonzuukenshi': { neteaseId: 3388574657, url: 'http://m801.music.126.net/20260711084122/5de27179db46cddf18c3a41f13a42753/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/80591335095/dc26/6a7a/94e0/b93b70f9687edf14d300c5c501f37ca4.mp3?vuutv=Q0v/SQNi5XDwRl8rdppq3rGG+8alqarYfNdMgvI/ED742xs+/g3eT2oCJgp51L6q8heQ5dqtUmtTwseb1OQkkvCC4lH1Y8s23UC/LZs/UPk=', isTrial: false },
  // 若月亮没来 - 王宇宙Leto/乔浚丞 (网易云: 若月亮没来 (若是月亮还没来), id: 2119795491)
  'hot_ruoyueliangmeilai_wangyuzhouleto': { neteaseId: 2119795491, url: 'http://m702.music.126.net/20260711083837/49d7d74818b43e30e0aa29c83aae0ad2/jd-musicrep-ts/be74/47a6/773f/92e01c57520e098ab411be2be16e217e.mp3?vuutv=SPHSxs5UfAygBJrJxrPI0hhZs7EP577ZnN95AEsly3kO3xpObGVkojGUPxHcHe3ms6QvhTEZfE6dwfdvQDn3l/qM5Eecn9Wsy7sCo8CmHwc=', isTrial: true },
  // 恋人 - 李荣浩 (网易云: 恋人, id: 2600493765)
  'hot_lianren_lironghao': { neteaseId: 2600493765, url: 'http://m802.music.126.net/20260711083841/9d726b02c1c423fb94b4489268c9194d/jd-musicrep-ts/403e/8251/6cab/b0a76feebf84ae67a99c37a38f950fd6.mp3?vuutv=oRoY10suPw1Ug1npQyrioMHvsQKntYAhHy6iY0w2SX7/W/IMnegN+76tBqRkOZXX/vo2rZlIvQS//ldcwVCJVYdzcy/yY27wXZsN/ksKa1Y=', isTrial: true },
  // Call My Name - 张艺兴 (网易云: 唤 (Call My Name), id: 1452412182)
  'hot_callmyname_zhangyixing': { neteaseId: 1452412182, url: 'http://m802.music.126.net/20260711083842/5f48bf112d4d271f3e91bbff476d0369/jd-musicrep-ts/18ae/3962/da77/dfa735016188a7574d5fca5ca09be939.mp3?vuutv=tuM0vP9Dv+mhdtzYMhylOoJgZpyi9G1Dnmmtosqn4AuP6AnGNxlDMUD74AMhZq+jVYkILT9ja0dh9RiqP7l2GiFsPvoGnWViHKfb6mp7i+E=', isTrial: true },
  // Crazy Love - 王以太/艾热 (网易云: Crazy Love, id: 3392180083)
  'hot_crazylove_wangyitaiaire': { neteaseId: 3392180083, url: 'http://m802.music.126.net/20260711083910/85c46b14509a4ee9d0e904f13c8223e2/jd-musicrep-ts/52a1/bd55/25a5/1c7347d63f44e1ee7047aa07701e5dcb.mp3?vuutv=CBL+z3Yz1oce6F4+wIPoYLVOXfMzTkfYWPWjNODNXB81SAVPS/IvmmK47PSJ0InH2VMoETxkNZqY7HMRy08YDTymRMSRyCNnLZ89Vtd26hk=', isTrial: true },
  // I Just Might - Bruno Mars (网易云: I Just Might, id: 3353220388)
  'hot_ijustmight_brunomars': { neteaseId: 3353220388, url: 'http://m702.music.126.net/20260711083916/4e2a70148a0d19fae6b2b16408fb2de2/jd-musicrep-ts/a1a7/2317/c679/7d7b17b127b68329869b2dbe8e2a327e.mp3?vuutv=PseVtWmEmw4LePfur4LWj9eWbCdtdmg9N9H5t9ZK7gjTwltYAxFl4giY9nxBLwFQP2MsFA2U1MCaZa/SUNgWdAQ4anS1r8VlAaIZugANqx0=', isTrial: true },
  // 雨过后的风景 - Dizzy Dizzo (网易云: 雨过后的风景, id: 215382)
  'hot_yuguohoudefengjing_dizzydizzo': { neteaseId: 215382, url: 'http://m802.music.126.net/20260711083918/cb105cbc1f9e6d9c2a4001fc8ac3cf08/jd-musicrep-ts/96f8/34da/cdf5/2a0d501f2f32215499c185834ee78860.mp3?vuutv=9rSPqwEV+k4PeqnE8BfIM+MdIiizFUp+IAKr/KZyTIec1BUnDO4QXAuIwOFgx3SSMMXYDLPrPdEcwixyY6rwZh6wdT119wp2n16noUHW38Y=', isTrial: true },
  // CHANEL - Tyla (网易云: CHANEL, id: 2757718427)
  'hot_chanel_tyla': { neteaseId: 2757718427, url: 'http://m702.music.126.net/20260711083919/1bebb39c8f6f856399079b573be69727/jd-musicrep-ts/4854/0b81/48fd/3b4cf8f397cc7bfff53ed7962a594a44.mp3?vuutv=65DgqU15pLjXvkPbuYb6pe+Wm1TiC6gTMS6YuBckJT/Nslbaa5bJcgXURedYnnjM2IsklhVySvWP7d6ccpOpxDtB0Uo4vWph++FZNFyZsfU=', isTrial: true },
  // Steal The Moon - 王俊凯 (网易云: Champion My Way, id: 2626695941)
  'hot_stealthemoon_wangjunkai': { neteaseId: 2626695941, url: 'http://m702.music.126.net/20260711083921/80b4fdc92540664e7b367a65ce8b29a3/jd-musicrep-ts/81ad/9a92/0c19/06e57198f4c5ca8f185f36731770a618.mp3?vuutv=E8eKL2mVB1AxjkNuPKOVES0AahqDPHHtFi9JcsdK5en1bllnS2QhixoHTvSaSMicmIUv78PfHB3oxSPvL9Vuk40jWusgaOEdKvzDDCWiLWw=', isTrial: true },
  // 阴天 - 莫文蔚 (网易云: 阴天, id: 108640)
  'emo_yintian_mowenwei': { neteaseId: 108640, url: 'http://m802.music.126.net/20260711083925/26e21a00e5b4cb6e47e5eb691d8445a6/jd-musicrep-ts/932b/ecde/dd12/e4980e8326a10fd72acea57f766b8d15.mp3?vuutv=w9YVr3/PM/AUMM2eARCZh2ErJBD/OBGDvrgIeqQm7ROoLyc3K3JM77oBcoz7qIe7qRFFI5hachYg7rUi2m5+njAl2csX6sDdmph+tsgwHxk=', isTrial: true },
  // 演员 - 薛之谦 (网易云: 演员, id: 32507038)
  'emo_yanyuan_xuezhiqian': { neteaseId: 32507038, url: 'http://m802.music.126.net/20260711083932/0ce3095501d2db6d4dc178c710f993ab/jd-musicrep-ts/eef1/ef79/49e5/0626b9dcacd00d1902f358c6f801c783.mp3?vuutv=g3Q7F6R4n3AMR8XkjRijcjugzH0JhVRZvjc6SoRSov75a/E/z9j1AVge20hvvXoxWLxwKxXjBGMF0F4Ibidm+I4oydba+5gXJsHFwVF2i9s=', isTrial: true },
  // 小美满 - 周深 (网易云: 小美满, id: 2124381474)
  'emo_xiaomeiman_zhoushen': { neteaseId: 2124381474, url: 'http://m802.music.126.net/20260711083941/704b6bca8c296e1c6155d2c58a526541/jd-musicrep-ts/5f35/d942/f157/eade5f4998483aae623b4f7643c9f140.mp3?vuutv=nt9RLkl8ov34ydaaZnds+m58nAKJ5B8DqE4gJT26VCywg0gSSV6KKtWM0kQz1cvUEqFw7ZToc7o+NcRFo7JbiZK9Hzs9JF9L+XIoI3jOlkg=', isTrial: true },
  // POWER - Kanye West (网易云: POWER, id: 18969204)
  'emo_power_kanyewest': { neteaseId: 18969204, url: 'http://m702.music.126.net/20260711083943/19a648ab3e049a6bad394c0bf88c39ab/jd-musicrep-ts/e8a0/37b3/b2c7/9183b897ff054f52b66c4ee5de6246e8.mp3?vuutv=fk/yss8Hi6J/d5Y+u2YKlAvdK25uXM70wp2FUZiVUEWt/vcVXkVMoObCwH1XIO0HgQ9wLQQ2HLtQT5aMGxkPYKeaFP4/ooEkzMWZ12xN/h4=', isTrial: true },
  // Runaway - Kanye West (网易云: Runaway, id: 18969210)
  'emo_runaway_kanyewest': { neteaseId: 18969210, url: 'http://m802.music.126.net/20260711083946/c56be8dabd15a727e7a3fea3605c926a/jd-musicrep-ts/a212/a86a/d800/32cf78acffb1425a8f7ee9581b35cdac.mp3?vuutv=S4q1cbQ0OWOMM8qyvFP+Y8qS5/ExU7It6KQT5HNaZg6YqSs1XY6+6iek5l5rXZOmjKtFvxZaPeQuh6y7yxB0Uys3XoTzauIQlVUR6M0Qr1U=', isTrial: true },
  // SICKO MODE - Travis Scott (网易云: SICKO MODE, id: 1298432425)
  'emo_sickomode_travisscott': { neteaseId: 1298432425, url: 'http://m702.music.126.net/20260711083948/898c5160f85d9f86f069c4675bb6f37f/jd-musicrep-ts/e825/99c3/4748/f76d5565d14e7432ca2fe056618833c8.mp3?vuutv=C31usXHFSsexYRd4aRP/2Qq3GKFg2BZtdIyiF+4ypKX7qu+vYmgR5XNIxGxuoMDqle5SeipT3qOyD2JkzErIoReZUvRLNkcu0TvUaiJxPFs=', isTrial: true },
  // Passionfruit - Drake (网易云: Passionfruit, id: 466343434)
  'emo_passionfruit_drake': { neteaseId: 466343434, url: 'http://m802.music.126.net/20260711083949/88469ec276b4c76457fb4c39eb6fd45f/jd-musicrep-ts/faf3/0e84/8ed0/010665906b616bb2c5eec45d500f4d97.mp3?vuutv=EJndiZyaRl/LnojkrJAcoNTnbcwGE1zsEHGo7ZfEFvFC0OhfcQjCIrUhi1UxYU3Ag74yVasPtaLdychNg7M/9gqskuY1jgsHhXR/kBDBeDs=', isTrial: true },
  // Circles - Post Malone (网易云: Circles, id: 1387574419)
  'emo_circles_postmalone': { neteaseId: 1387574419, url: 'http://m802.music.126.net/20260711083951/9a64832ad8474b6857e60f1f0f635306/jd-musicrep-ts/aaae/96b8/c877/ee2fdf05b49be26f70b8295b09cb5e6c.mp3?vuutv=+mb1SNGVrVEU3VC8lx60YbLZESqh0Tiq0WxMtM86UXDDnVrQfOLtGxx6XO5Q5TRktxQ6MaHiohoOdTxE8Fxqt6V12Spdpgu+r+I4SV5XihE=', isTrial: true },
  // Heartless - Kanye West (网易云: Heartless, id: 18969180)
  'emo_heartless_kanyewest': { neteaseId: 18969180, url: 'http://m702.music.126.net/20260711083953/c3c60a0ac07b0c14d1cd74ed06238e3c/jd-musicrep-ts/6467/0556/d9af/183d14a24395ac9163600c7ac06c291b.mp3?vuutv=M3MInS3TSkhQvMw+hVv/gmhMt4dZyPRmI1Ie2q0hDasSrF0cTRiGdmyDT4G1GPjlpYpNjYgNI5I6N7ZoV5CKw3G3EsLnDs4S40qCUIYR9k8=', isTrial: true },
  // The Hills - The Weeknd (网易云: The Hills, id: 32337668)
  'emo_thehills_theweeknd': { neteaseId: 32337668, url: 'http://m702.music.126.net/20260711083954/5f11e81ebdcdc85678eba7e62239894c/jd-musicrep-ts/7811/fcdd/a09e/55e8efca10c42497da3831c12dcf8ed9.?vuutv=jyYYrmUb7O/EaBdyXZ2OMQBycsCqlgscc94BDN2KJNJqGe03QThykubU7+2rK2mmLp/95PgXi0nzpDgAm4PhtYIwQuxxyiju04TLY3OSdJE=', isTrial: true },
  // goosebumps - Travis Scott (网易云: goosebumps, id: 428642135)
  'emo_goosebumps_travisscott': { neteaseId: 428642135, url: 'http://m802.music.126.net/20260711083956/6cb1b14fa07495f58ff122a51de526fd/jd-musicrep-ts/e2b1/55c9/b21b/691fb5c44dcae1047d2caf10735add94.mp3?vuutv=tDI+XcRLAelYc5HZK08I0ZMva+KnuWcYnkA5P/mLk42asiI9UvM8823LtzMSY1AF2A8yDYqU0cpam7/ABqZFXgipL2EKE0w5qcNagoPGZGE=', isTrial: true },
  // No Idea - Don Toliver (网易云: No Idea, id: 1367786494)
  'emo_noidea_dontoliver': { neteaseId: 1367786494, url: 'http://m702.music.126.net/20260711083958/e7756e8f521424ff04e114c7fb49bbad/jd-musicrep-ts/34fa/f9df/f529/6a7e058e937010b511fa15f980632c44.mp3?vuutv=7+KmYsL4c7ogjkEBtpz5u1z072JtOtgDEC6kVMRo8FEejIzfmS0x31eRrMGtjUed93F0uaZp5E0vvO5ux4EotwwqgqYSJCqcUdPqJ5+a7xY=', isTrial: true },
  // 相思锁 - 张真源 (网易云: 镜花水月, id: 2643061411)
  'hot_xiangshensuo_zhangzhenyuan': { neteaseId: 2643061411, url: 'http://m702.music.126.net/20260711084013/297f16475b5a3989966d58b7308a4f2f/jd-musicrep-ts/93b8/87a2/c166/7bf7700535ea28dab5bcc71a0c454d3b.mp3?vuutv=KLzxu5ingM6xRP/LzuuE4DKs1rYukSn6L8Cf/bf9p0hSl+GgUOdFG3lHFhx11s1qtGX9fjnx6/aV1BhJnM/hX5rheK/pMLeFhzo6QSOs57M=', isTrial: true },
  // 明日坐标 - 林俊杰 (网易云: Always Online, id: 108485)
  'hot_mingrizuobiao_linjunjie': { neteaseId: 108485, url: 'http://m702.music.126.net/20260711084018/ac581ce57dc5042cca584dffdddb9caf/jd-musicrep-ts/ec1d/9d80/3f96/36273712237b0c5e4775b5e5b0a424f6.mp3?vuutv=4zD/cvHVF0It0VlEISFOUaGJQz+SXQ13rzlss/SA7ihZhAIDqTdDZ++znjyikU4SEvNWtSZxrpWbGAGoHLTZ2k4JrXCkVenbeKGtZiO1gVU=', isTrial: true },
  // 恒星不忘 forever - F3/五月天阿信 (网易云: 一半人生, id: 1339725941)
  'hot_hengxingbuwang_f3_maydayashin': { neteaseId: 1339725941, url: 'http://m702.music.126.net/20260711084019/695091eeb488550308fd19156a4fa29f/jd-musicrep-ts/c505/7a2f/f087/5e9d6d2214b19cdbad836d3d88b4f132.mp3?vuutv=HYtTsC7nbQJhphwhn3CBGyIMKTrxlSqfd6W+k2Rg5XnzJZ/L1l9kNkhhfoISQ3Fh0OUO1yVK6UKLHXt7YEY8BlsPjrROSDPIuDr4klXuFk4=', isTrial: true },
  // 世界赠予我的 - 王菲 (网易云: 世界赠予我的, id: 2668124242)
  'hot_shijiezengyuwode_wangfei': { neteaseId: 2668124242, url: 'http://m802.music.126.net/20260711084021/5d6bd8d9b2bc6dec250e8eace1ab0c96/jd-musicrep-ts/3d9d/3370/98c0/2ed0c02dcde67d649404760cfa508a5d.mp3?vuutv=CVJnyn50zItXCBHg3x3OpkkjJRJOKbm8B25L1PaKJSgoA1agb+nqydpRFOYBacTBW55b8HFBUoTtRWb+SKWkCQt5ERSq4yed9kSZL6foEwc=', isTrial: true },
  // 主角 - 王菲 (网易云: 主角, id: 3378698307)
  'hot_zhujue_wangfei': { neteaseId: 3378698307, url: 'http://m802.music.126.net/20260711084034/6bf2f7455f21ec5dce760a8509172eff/jd-musicrep-ts/6de3/8e09/3a83/19a53faa0d7ff783cb37868cb435c96a.mp3?vuutv=KRqO+05NvxDHBvcX5zT2F3bmvoeCud2HE7c1fNFnL6ewS1x8u5FsAlhEdst1Md/FTd7hrZNqjk313Qxhz7zNVibKMkZb+n0a4YiH691xZqY=', isTrial: true },
  // Choosin' Texas - Ella Langley (网易云: Choosin' Texas, id: 2755496359)
  'hot_choosintexas_ellalangley': { neteaseId: 2755496359, url: 'http://m702.music.126.net/20260711084048/708d76c1ef0a555ceb46c9ceab8d5c46/jd-musicrep-ts/9ed2/fc71/cf87/f4ecde2389c36f05411c4b19acb2dcf5.mp3?vuutv=X5+3puw1yFmIWRTOnr7ekgllZgTG2hefQQ/xiAFOeOMRnhTIbd2jRe7VEjkJh99TNFIsago7gmlbQ5Spr2ZpMkqHVom00Sv90M2jp84cgJU=', isTrial: true },
  // I Knew It, I Knew You - Taylor Swift (网易云: I Knew It, I Knew You, id: 3390083812)
  'hot_iknewit_taylorswift': { neteaseId: 3390083812, url: 'http://m702.music.126.net/20260711084052/ec6d7287e728c5776d9881891ff0c655/jd-musicrep-ts/91c9/db25/ac6d/e265371fc64f836c3fc5eec7bca7efb0.mp3?vuutv=xwgn44L0ah3+9HShi3376hsWAXqfx4ZfqO36oujkLrAHS9EoiF5mNbaI2OwlknBgKxXpNVxggzzr9db0NOB8EYiz2rmANnqXYIQspUQk6MU=', isTrial: true },
  // Runway - Lady Gaga & Doechii (网易云: Runway, id: 3368693943)
  'hot_runway_ladygaga_doechii': { neteaseId: 3368693943, url: 'http://m702.music.126.net/20260711084056/8d4d561301b878cc6ba1e30465000df9/jd-musicrep-ts/bff9/4d91/2a0a/62c9e18f149e9b8cb6d2cd7659c12441.mp3?vuutv=emq7ULW2kMSy/2LrnID0v+ZXSK2CNklLICSUe/G1VHS7T7vqQDV1v92fRtDgWo38joLxyJ3Pj7Ve0zmrbL1RfGnABWnMd4u68okFvl5JX4Y=', isTrial: true },
  // Fever Pitch - Richz (网易云: Fever Pitch, id: 3362038053)
  'hot_feverpitch_richz': { neteaseId: 3362038053, url: 'http://m702.music.126.net/20260711084059/325a7d66f656aad1192f22df302defcf/jd-musicrep-ts/7822/7bd8/27ab/bcd4207cdfaf45ba0870c986667f9ba4.mp3?vuutv=P9W7g/fKFETV9mv0a+QIGeLao7PlF3szSbo15c3JUmk4xAIfVpwHi2zj403g0v42NmZMh3s4Jda1JCNmFaSUIGAktDALp3SB5qL7CpOUpso=', isTrial: true },
  // Into You - Ariana Grande (网易云: Into You, id: 411921901)
  'hot_intoyou_arianagrande': { neteaseId: 411921901, url: 'http://m702.music.126.net/20260711084102/b0fa9c2fd6c2b65adc86db23b87657d6/jd-musicrep-ts/78d3/b9aa/1d2c/77556110600e49bd842afd1066a94fc1.mp3?vuutv=jVPaX1HbthUlq4snatWsbJYPqSfoNSkXmbWh7WxGuc9UAn94zPwAiwkN1R4HdRYsFsb5lje9H4e59eEzHZxzdwyQWyMV0nYo7z0ATmamvqs=', isTrial: true },
  // Man I Need - Olivia Dean (网易云: Man I Need, id: 2736184137)
  'emo_manineed_oliviadean': { neteaseId: 2736184137, url: 'http://m802.music.126.net/20260711084106/735dbbb709766dd1d927a319c296d7c9/jd-musicrep-ts/9870/44db/d44b/7947261a1136e3c3e1165162db3bd4df.mp3?vuutv=99J4BJk/IqEvbaaSAMkN6nS6khf0FYY3g5YomgJB72HYP/lz+RtipU/t5vGQqfRoAIZzsFQy0c5AxPl3BPYSUKUy13gVFL5Xk9mez08ApN8=', isTrial: true },
  // Be Her - Ella Langley (网易云: Be Her, id: 3367502261)
  'emo_beher_ellalangley': { neteaseId: 3367502261, url: 'http://m802.music.126.net/20260711084110/548e49b19167637fcd6cfc9aaeede7d4/jd-musicrep-ts/27a4/dc8a/d80f/e4dc13bbbf166416e0ed1f96ab13d201.mp3?vuutv=TeNWc/uT676YKreNSJU0N95EwmlT0Wcm7u8mFjrMnlr8Ucn0xgENp7XjdTCSMidpTuTMdiB7JFu0Co/FV2Dvam4fCpSnVappLR8y0RX/8dA=', isTrial: true },
  // ANGEL (天使) - 尹美莱/Tiger JK/Bizzy (网易云: Angel, id: 29777545)
  'emo_angel_yinmeilai': { neteaseId: 29777545, url: 'http://m802.music.126.net/20260711084112/022cd06a79581c88b2f187b1140e11ef/jd-musicrep-ts/2d5e/85b6/a6a6/aaef03a79144d4ae05374021d7cdae44.mp3?vuutv=4Rz16lxJazRUdojk28s5RtNOmdvrrETRQSZ0+5EYBGxCkD94i3BwB47874I1/0ilSY5nRyl1pyIsQuEB39zG6BnIsfA/odQDnvfWfSeAEkI=', isTrial: true },
  // AIZO - King Gnu (网易云: AIZO, id: 3337367763)
  'emo_aizo_kinggnu': { neteaseId: 3337367763, url: 'http://m702.music.126.net/20260711084123/7b94ad3488f87f3a9c1c616b3bb2db5b/jd-musicrep-ts/e315/de1a/f820/cf45e9c296e0db666a5423edf8c1a41b.mp3?vuutv=2IQMXZkoQuSG7PQXHVYVszXLGNDHj4aWXVHbYHdKv4f7h1X58rMVH+1o5Iu89r8LPK6VDw2jjqgQK38X9y240+36r77y9R57cUEgqlIMQGg=', isTrial: true },
};
