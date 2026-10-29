import React from 'react';
import ColorPicker from '@/shared/ui/ColorPicker/ColorPicker';

interface CommonColorProps {
  label?: string;
  initialColor?: string;
  onChange?: (color: string) => void;
}

/**
 * Label + ColorPicker 조합 컴포넌트
 * 패널 내부에서 label과 함께 사용할 때
 *
 * ## 사용 예시
 * ```tsx
 * <CommonColor label="배경색" initialColor="#ffffff" onChange={handleChange} />
 * ```
 */
const CommonColor = ({ label, initialColor, onChange }: CommonColorProps) => {
  return (
    <div className="btn-editor-wrap px-(--control-x)">
      {label && <p>{label}</p>}
      <ColorPicker initialColor={initialColor} onChange={onChange} />
    </div>
  );
};

export default CommonColor;
