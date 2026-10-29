// components/Icon.tsx
'use client';

import React from 'react';

// Material Symbols 아이콘 이름 타입
export type IconName = string;

interface IconProps {
  name: IconName;
  className?: string;
  width?: number; // 아이콘 크기 (font-size 및 opsz에 동시 적용)
  height?: number;
  color?: string;
  fill?: boolean; // 'FILL'
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700; // 'wght'
  style?: React.CSSProperties;
}

/**
 * Google Material Symbols 폰트 아이콘 컴포넌트 (수정됨)
 * - 'wght', 'opsz' 등 모든 variable settings를 JS에서 제어합니다.
 */
const Icon: React.FC<IconProps> = ({
  name,
  className = '',
  width = 24, // 기본 크기 24
  height, // height가 없으면 width와 동일하게
  color,
  fill = false,
  weight, // 명시하지 않으면 size 기반 자동 결정
  style,
  ...props
}) => {
  const iconSize = `${width}px`;
  const iconHeight = height ? `${height}px` : iconSize;

  const opticalSize = width;
  // Font Weight Rule: 24px 이상 → Light(300), 24px 미만 → Regular(400)
  const autoWeight = width >= 24 ? 300 : 400;
  const finalWeight = weight ?? autoWeight;

  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{
        fontSize: iconSize,
        width: iconSize,
        height: iconHeight,
        color: color,
        // CSS를 덮어쓰는 것이 아니라, JS에서 모든 설정을 제어
        fontVariationSettings: `
          'FILL' ${fill ? 1 : 0},
          'wght' ${finalWeight},
          'GRAD' 0,
          'opsz' ${opticalSize}
        `,
        lineHeight: 1, // 폰트가 정확한 높이를 갖도록 1로 설정
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
};

export default Icon;
