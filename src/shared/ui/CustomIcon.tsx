// shared/ui/CustomIcon.tsx
'use client';

import React from 'react';
import KeywordBtnBg from '@/assets/icons/keyword-btn-bg.svg';
import SelectTemplate from '@/assets/icons/select-template.svg';
import TextUnderLine from '@/assets/icons/text_under_line.svg';
import Front from '@/assets/icons/front.svg';
import First from '@/assets/icons/first.svg';
import Behind from '@/assets/icons/behind.svg';
import Back from '@/assets/icons/back.svg';
import Union from '@/assets/icons/union.svg';
import Kakao from '@/assets/icons/kakao.svg';
import Google from '@/assets/icons/google.svg';
import InkHighlighter from '@/assets/icons/ink_highlighter.svg';
import Profile from '@/assets/icons/profile.svg';
import FolderLoading from '@/assets/icons/folder_loading.svg';
import Ai from '@/assets/icons/ai.svg';
import AiStar from '@/assets/icons/aiStar.svg';
import AiStar24 from '@/assets/icons/aiStar24.svg';
import ImageEmpty from '@/assets/icons/image-empty.svg';
import Group from '@/assets/icons/group.svg';
import Ungroup from '@/assets/icons/ungroup.svg';

// Figma에서 만든 커스텀 SVG 아이콘 매핑
const customIconMap = {
  'keyword-btn-bg': KeywordBtnBg,
  'select-template': SelectTemplate,
  'text-under-line': TextUnderLine,
  front: Front,
  first: First,
  behind: Behind,
  back: Back,
  union: Union,
  kakao: Kakao,
  google: Google,
  ink_highlighter: InkHighlighter,
  profile: Profile,
  'folder-loading': FolderLoading,
  ai: Ai,
  'ai-star': AiStar,
  'ai-star-24': AiStar24,
  'image-empty': ImageEmpty,
  group: Group,
  ungroup: Ungroup,
} as const;

export type CustomIconName = keyof typeof customIconMap;

interface CustomIconProps {
  name: CustomIconName;
  className?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

/**
 * Figma에서 만든 커스텀 SVG 아이콘을 렌더링하는 컴포넌트
 * - currentColor를 지원하여 CSS의 text-color로 색상 제어 가능
 * - Material Symbols 폰트 아이콘(Icon 컴포넌트)과 구분됨
 */
const CustomIcon: React.FC<CustomIconProps> = ({
  name,
  className = '',
  width = 100,
  height = 100,
  style,
  ...props
}) => {
  const raw = customIconMap[name];

  if (!raw) {
    console.warn(`CustomIcon "${name}" not found`);
    return null;
  }

  // SVGR 기본 export / default 래핑 / (드물게) 잘못된 asset 객체 모두 대응
  const SvgComponent =
    typeof raw === 'function'
      ? raw
      : raw && typeof raw === 'object' && 'default' in raw && typeof (raw as { default: unknown }).default === 'function'
        ? (raw as { default: React.FC<React.SVGProps<SVGSVGElement>> }).default
        : null;

  if (!SvgComponent) {
    console.warn(`CustomIcon "${name}" is not a React component (SVG loader 설정을 확인하세요)`);
    return null;
  }

  return (
    <SvgComponent
      width={width}
      height={height}
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
};

export default CustomIcon;
