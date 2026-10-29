import { toast } from 'sonner';
import Icon from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/Icon';

/** 토스트 타입별 색상 정의 (Figma 기준) */
const toastColors = {
  error: { main: '#E65050', bg: '#FFF2F2' },
  success: { main: '#00BD01', bg: '#F2FFF2' },
  info: { main: '#5DADEC', bg: '#F9FBFD' },
  warn: { main: '#F2860A', bg: '#FFF7E6' },
} as const;

/** 토스트 타입별 아이콘 */
const toastIcons: Record<keyof typeof toastColors, IconName> = {
  error: 'cancel',
  success: 'check_circle',
  info: 'info',
  warn: 'error',
};

/** 아이콘 크기 (Figma 기준 24x24) */
const ICON_SIZE = 24;

/** 커스텀 토스트 컴포넌트 (Figma 디자인 그대로) */
const ToastContent = ({ type, message }: { type: keyof typeof toastColors; message: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      borderRadius: '6px',
      backgroundColor: toastColors[type].bg,
      color: toastColors[type].main,
      boxShadow: `0 0 16px 0 ${toastColors[type].main}29`,
    }}
  >
    <Icon name={toastIcons[type]} width={ICON_SIZE} height={ICON_SIZE} />
    <span className="p" style={{ whiteSpace: 'nowrap' }}>
      {message}
    </span>
  </div>
);

/**
 * 커스텀 토스트 헬퍼
 * toast.custom()으로 완전한 스타일 제어
 */
export const showToast = {
  success: (msg: string) => toast.custom(() => <ToastContent type="success" message={msg} />),

  error: (msg: string) => toast.custom(() => <ToastContent type="error" message={msg} />),

  info: (msg: string) =>
    toast.custom(() => <ToastContent type="info" message={msg} />, {
      duration: Number.POSITIVE_INFINITY,
    }),

  warn: (msg: string) =>
    toast.custom(() => <ToastContent type="warn" message={msg} />, {
      duration: 3000,
    }),

  /** 기존 info 토스트 메시지 업데이트 (진행률 표시용) */
  updateInfo: (id: string | number, msg: string) =>
    toast.custom(() => <ToastContent type="info" message={msg} />, {
      id,
      duration: Number.POSITIVE_INFINITY,
    }),
};

// toast 원본 export (dismiss 등 사용 가능)
export { toast };
