export type Theme = 'light' | 'dark' | 'system';

// ModalType과 MODAL_TYPES는 @/shared/ui/Modal/types.ts로 이동됨

export type PopoverContentType = 'download' | 'fileUpload' | 'userProfile';

export const POPOVER_CONTENT_TYPES = {
  DOWNLOAD: 'download' as const,
  FILE_UPLOAD: 'fileUpload' as const,
  USER_PROFILE: 'userProfile' as const,
} as const;

export type PopoverPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
