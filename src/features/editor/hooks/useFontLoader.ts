'use client';

/**
 * 폰트 로드 훅
 *
 * - Google Fonts 스타일시트 자동 삽입
 * - 로드 상태 관리
 * - Konva 캔버스 재렌더링 트리거
 */

import { useCallback, useRef } from 'react';
import { loadFont, injectGoogleFontStylesheet, isFontLoaded } from '../lib/font-loader';
import { getFontByFamily } from '../constants/fonts';

/**
 * 폰트 로드 훅
 *
 * @example
 * const { loadFontWithWeight } = useFontLoader();
 * await loadFontWithWeight('Noto Sans KR', 700);
 */
export function useFontLoader() {
  // 로딩 중인 폰트 추적 (중복 요청 방지)
  const loadingRef = useRef<Set<string>>(new Set());

  const loadFontWithWeight = useCallback(
    async (fontFamily: string, weight: number): Promise<boolean> => {
      const cacheKey = `${fontFamily}-${weight}`;

      // 이미 로드된 경우
      if (isFontLoaded(fontFamily, String(weight))) {
        return true;
      }

      // 이미 로딩 중인 경우
      if (loadingRef.current.has(cacheKey)) {
        return false;
      }

      const fontDef = getFontByFamily(fontFamily);

      // 알 수 없는 폰트 (fallback 허용)
      if (!fontDef) {
        return loadFont(fontFamily, String(weight));
      }

      loadingRef.current.add(cacheKey);

      try {
        // Google Fonts인 경우 스타일시트 삽입 및 로드 대기
        if (fontDef.source === 'google' && fontDef.googleUrl) {
          await injectGoogleFontStylesheet(fontDef.googleUrl);
        }

        // 폰트 로드 대기
        return await loadFont(fontFamily, String(weight));
      } catch {
        return false;
      } finally {
        loadingRef.current.delete(cacheKey);
      }
    },
    [],
  );

  return { loadFontWithWeight };
}
