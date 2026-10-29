// --- ICONS ---
// (커스텀 아이콘 SVG를 React 컴포넌트로 import)
// 예: import IconMyIcon from '@/assets/icons/my-icon.svg';
// --- ILLUSTRATIONS (SVG/PNG/JPG...) ---
// (src/assets/illustrations/ 경로의 파일들)
// 'next/image' 컴포넌트용으로 import (StaticImageData 객체가 됨)

import Start1Svg from '@/assets/illustrations/start-1.svg';
import Start2Svg from '@/assets/illustrations/start-2.svg';
import WhiteSearchSvg from '@/assets/illustrations/white-search.svg';
import DetailPageFrameSvg from '@/assets/illustrations/detail-page-frame.svg';
import LoginSvg from '@/assets/illustrations/login.svg';
import SaveScreenSvg from '@/assets/illustrations/SaveScreen.svg';
import ProjectLoadingSvg from '@/assets/illustrations/project-loading.svg';
import GuidePng from '@/assets/illustrations/guide.png';

/**
 * 일러스트레이션 (SVG, PNG 등)
 * - src/assets에서 import하면 Next.js가 자동으로 최적화
 * - <Image> 컴포넌트의 src prop으로 사용
 */
export const ILLUSTRATIONS = {
  // Start 섹션
  Start1: Start1Svg,
  Start2: Start2Svg,
  // Features 섹션
  WhiteSearch: WhiteSearchSvg,
  DetailPageFrame: DetailPageFrameSvg,
  // Auth
  Login: LoginSvg,
  SaveScreen: SaveScreenSvg,
  // Editor
  ProjectLoading: ProjectLoadingSvg,
  // Dialog
  Guide: GuidePng,
} as const;

// --- IMAGES (PNG/JPG/WebP...) ---
// (src/assets/images/ 경로의 파일들)
// 'next/image' 컴포넌트용으로 import (StaticImageData 객체가 됨)

import Thumbnail from '@/assets/images/thumbnail.jpeg';
import EmailPng from '@/assets/images/email.png';
import EmailSuccessPng from '@/assets/images/email-success.png';

/**
 * 이미지 (PNG, JPG 등)
 * - src/assets에서 import하면 Next.js가 자동으로 최적화
 * - <Image> 컴포넌트의 src prop으로 사용
 */
export const IMAGES = {
  Thumbnail,
  Email: EmailPng,
  EmailSuccess: EmailSuccessPng,
} as const;
