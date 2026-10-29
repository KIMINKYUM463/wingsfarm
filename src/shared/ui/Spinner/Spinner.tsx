interface SpinnerProps {
  /**
   * 스피너 크기 (px)
   * @default 20
   */
  size?: number;
  /**
   * 추가 CSS 클래스 (색상은 text-* 클래스로 지정)
   */
  className?: string;
}

/**
 * 로딩 스피너 컴포넌트 (Figma 디자인)
 * 버튼이나 로딩 상태 표시에 사용
 *
 * @example
 * ```tsx
 * <Spinner size={29} className="text-(--color-point)" />
 * ```
 */
const Spinner = ({ size = 20, className = 'text-gray-300' }: SpinnerProps) => {
  // 크기 비율 계산 (원본 디자인: 29x29)
  const scale = size / 29;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 29 29"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="로딩 중"
      style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
    >
      <g clipPath="url(#clip0_spinner)">
        <path
          d="M7.07107 7.07107C10.9763 3.16583 17.308 3.16582 21.2132 7.07107L19.0919 9.19239C16.3582 6.45872 11.9261 6.45872 9.19239 9.19239C6.45872 11.9261 6.45872 16.3582 9.19239 19.0919L7.07107 21.2132C3.16582 17.308 3.16582 10.9763 7.07107 7.07107Z"
          fill="currentColor"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 14.1421 14.1421"
            to="360 14.1421 14.1421"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      <defs>
        <clipPath id="clip0_spinner">
          <rect width="20" height="20" fill="white" transform="translate(0 14.1421) rotate(-45)" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default Spinner;
