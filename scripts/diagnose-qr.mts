/**
 * 诊断网易云 QR 登录 API 真实返回结构
 *
 * 用法: npx tsx scripts/diagnose-qr.mts
 *
 * 目的: 确认 login_qr_key / login_qr_create / login_qr_check 的返回格式,
 *       避免再因数据结构误判导致 bug。
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi');

async function main() {
  console.log('=== 1. login_qr_key ===');
  const keyRes = await NeteaseCloudMusicApi.login_qr_key({ timestamp: Date.now() });
  console.log('top-level keys:', Object.keys(keyRes));
  console.log('body keys:', keyRes.body ? Object.keys(keyRes.body) : 'no body');
  console.log('full structure:', JSON.stringify(keyRes, null, 2).slice(0, 800));
  const unikey = keyRes?.body?.data?.unikey ?? keyRes?.data?.unikey;
  if (!unikey) {
    console.error('❌ 拿不到 unikey');
    return;
  }
  console.log('✅ unikey:', unikey);

  console.log('\n=== 2. login_qr_create ===');
  const createRes = await NeteaseCloudMusicApi.login_qr_create({
    key: unikey,
    qrimg: true,
    timestamp: Date.now(),
  });
  console.log('top-level keys:', Object.keys(createRes));
  console.log('body keys:', createRes.body ? Object.keys(createRes.body) : 'no body');
  const qrimg = createRes?.body?.data?.qrimg ?? createRes?.data?.qrimg;
  console.log('qrimg prefix:', qrimg ? qrimg.slice(0, 50) : 'MISSING');

  console.log('\n=== 3. login_qr_check (未扫码状态) ===');
  const checkRes = await NeteaseCloudMusicApi.login_qr_check({
    key: unikey,
    timestamp: Date.now(),
  });
  console.log('top-level keys:', Object.keys(checkRes));
  console.log('body keys:', checkRes.body ? Object.keys(checkRes.body) : 'no body');
  console.log('body.code:', checkRes?.body?.code);
  console.log('body.message:', checkRes?.body?.message);
  console.log('body.data:', checkRes?.body?.data);
  console.log('full body:', JSON.stringify(checkRes?.body, null, 2).slice(0, 600));

  console.log('\n=== 结论 ===');
  console.log('login_qr_check 返回的 code 在:', checkRes?.body?.code !== undefined ? 'body.code ✅' : '❓');
  console.log('login_qr_check 返回的 message 在:', checkRes?.body?.message !== undefined ? 'body.message ✅' : '❓');
}

main().catch((e) => {
  console.error('诊断失败:', e);
  process.exit(1);
});
