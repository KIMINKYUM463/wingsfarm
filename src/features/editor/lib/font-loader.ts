/**
 * Konva 폰트 로드 유틸리티
 *
 * Konva 공식 가이드 기반 구현:
 * - document.fonts.load() API 사용 (모던 브라우저)
 * - width measurement fallback (구형 브라우저)
 * - Google Fonts 스타일시트 동적 삽입
 *
 * @see https://konvajs.org/docs/sandbox/Custom_Font.html
 */

/** 로드된 폰트 캐시 */
const loadedFonts: Record<string, boolean> = {};

/** 삽입된 스타일시트 캐시 */
const injectedStylesheets: Set<string> = new Set();

/**
 * 폰트 너비 측정 (로드 감지용)
 */
function measureFont(
  fontName: string,
  fallbackFont: string,
  fontStyle = 'normal',
  fontWeight = '400',
): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const sampleText = 'The quick brown fox 0123456789 가나다라마바사';
  ctx.font = `${fontStyle} ${fontWeight} 16px '${fontName}', ${fallbackFont}`;
  return ctx.measureText(sampleText).width;
}

/**
 * 지연 유틸
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 스타일시트 로드 Promise 캐시 */
const stylesheetLoadPromises: Map<string, Promise<void>> = new Map();

/**
 * Google Fonts 스타일시트 삽입 및 로드 대기
 *
 * @param url - Google Fonts CSS URL
 * @returns Promise<void> - 스타일시트 로드 완료 시 resolve
 */
export function injectGoogleFontStylesheet(url: string): Promise<void> {
  // 이미 로드 중인 경우 기존 Promise 반환
  const existingPromise = stylesheetLoadPromises.get(url);
  if (existingPromise) return existingPromise;

  // 이미 삽입된 경우
  if (injectedStylesheets.has(url)) return Promise.resolve();

  const existingLink = document.querySelector(`link[href="${url}"]`);
  if (existingLink) {
    injectedStylesheets.add(url);
    return Promise.resolve();
  }

  // 새 스타일시트 삽입 및 로드 대기
  const loadPromise = new Promise<void>((resolve, reject) => {
    const fontLink = document.createElement('link');
    fontLink.href = url;
    fontLink.rel = 'stylesheet';

    fontLink.onload = async () => {
      injectedStylesheets.add(url);
      stylesheetLoadPromises.delete(url);

      // 스타일시트 로드 후 브라우저가 폰트를 파싱할 시간 대기
      // document.fonts.ready는 현재 등록된 모든 폰트가 로드될 때까지 대기
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      resolve();
    };

    fontLink.onerror = () => {
      stylesheetLoadPromises.delete(url);
      reject(new Error(`Failed to load font stylesheet: ${url}`));
    };

    document.head.appendChild(fontLink);
  });

  stylesheetLoadPromises.set(url, loadPromise);
  return loadPromise;
}

/**
 * 폰트 로드 캐시 키 생성
 */
function getCacheKey(fontName: string, fontWeight: string, fontStyle: string): string {
  return `${fontName}-${fontWeight}-${fontStyle}`;
}

/**
 * 폰트 로드 및 대기
 *
 * @param fontName - CSS font-family 이름
 * @param fontWeight - 로드할 weight (기본: '400')
 * @param fontStyle - 로드할 스타일 (기본: 'normal')
 * @returns Promise<boolean> - 로드 성공 여부
 */
export async function loadFont(
  fontName: string,
  fontWeight = '400',
  fontStyle = 'normal',
): Promise<boolean> {
  const cacheKey = getCacheKey(fontName, fontWeight, fontStyle);

  // 이미 로드된 경우
  if (loadedFonts[cacheKey]) return true;

  const hasFontsLoadSupport = typeof document !== 'undefined' && !!document.fonts?.load;

  // 모던 브라우저: document.fonts.load() API 사용
  if (hasFontsLoadSupport) {
    try {
      // 먼저 document.fonts.ready 대기 (스타일시트 파싱 완료 보장)
      await document.fonts.ready;

      const fontSpec = `${fontStyle} ${fontWeight} 16px '${fontName}'`;
      const loadedFontFaces = await document.fonts.load(fontSpec);

      // 폰트가 실제로 로드되었는지 확인
      if (loadedFontFaces.length > 0) {
        await delay(60); // 안정화 대기
        loadedFonts[cacheKey] = true;
        return true;
      }

      // FontFace가 없으면 width 측정으로 확인
      const arialWidth = measureFont('Arial', 'Arial', fontStyle, fontWeight);
      const newWidth = measureFont(fontName, 'Arial', fontStyle, fontWeight);

      if (arialWidth !== newWidth) {
        await delay(60);
        loadedFonts[cacheKey] = true;
        return true;
      }
    } catch {
      // fallback to polling
    }
  }

  // Fallback: Polling 방식
  const arialWidth = measureFont('Arial', 'Arial', fontStyle, fontWeight);
  const timesWidth = measureFont('Times', 'Times', fontStyle, fontWeight);
  const lastWidth = measureFont(fontName, 'Arial', fontStyle, fontWeight);
  const waitTime = 60;
  const timeout = 6000; // 최대 6초 대기
  const attemptsNumber = Math.ceil(timeout / waitTime);

  for (let i = 0; i < attemptsNumber; i++) {
    const newWidthArial = measureFont(fontName, 'Arial', fontStyle, fontWeight);
    const newWidthTimes = measureFont(fontName, 'Times', fontStyle, fontWeight);

    const somethingChanged =
      newWidthArial !== lastWidth || newWidthArial !== arialWidth || newWidthTimes !== timesWidth;

    if (somethingChanged) {
      await delay(60);
      loadedFonts[cacheKey] = true;
      return true;
    }

    await delay(waitTime);
  }

  return false;
}

/**
 * 폰트 로드 상태 확인
 */
export function isFontLoaded(fontName: string, fontWeight = '400', fontStyle = 'normal'): boolean {
  return loadedFonts[getCacheKey(fontName, fontWeight, fontStyle)] ?? false;
}
