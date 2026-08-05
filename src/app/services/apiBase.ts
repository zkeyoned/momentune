/**
 * API base 解析层
 *
 * Web 环境:返回相对路径(同源,Vercel Serverless Functions)。
 * Capacitor 原生壳:页面 origin 为 capacitor://localhost,相对 /api/* 会失败,
 * 必须指向线上部署的绝对域名。
 */
import { Capacitor } from '@capacitor/core';

const PROD_API_ORIGIN = 'https://momentune.vercel.app';

/** 把 '/api/xxx' 解析为当前环境可用的完整 URL(Web 下原样返回) */
export function apiUrl(path: string): string {
  return Capacitor.isNativePlatform() ? `${PROD_API_ORIGIN}${path}` : path;
}
