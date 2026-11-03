/**
 * 서버 전용 설정 데이터 유틸리티
 * API 키 존재 여부 조회 (서버 컴포넌트용)
 */

import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { getApiKeyInfo, getCopyModelInfo } from '@/server/lever/settings';

/**
 * API 키 조회 (cache 메모이제이션)
 * 같은 요청 내에서 여러 번 호출해도 1회만 조회
 *
 * 로컬 파일에서 읽으므로 빌드 때 미리 렌더링되지 않도록 요청 시점에만 실행한다.
 *
 * @returns API 키 정보 또는 null (미등록)
 */
export const getApiKey = cache(async () => {
  await connection();
  return getApiKeyInfo();
});

/** 판매 문구 AI 선택값 + OpenAI 키 유무 */
export const getCopyModelSettings = cache(async () => {
  await connection();
  return getCopyModelInfo();
});
