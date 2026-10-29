/** 에디터 AI 채팅 수정 요청·응답 (서버 chat.ts ↔ 에디터 AiChatPanel) */
export type ChatTextAlign = 'left' | 'center' | 'right';

export interface ChatTextState {
  text: string;
  align: ChatTextAlign;
  fontSize: number;
}

export interface ChatEditRequest {
  message: string;
  /** 지정하면 그 페이지만, 없으면 문서 전체 */
  scopeFrameId?: string | null;
  frames: { frameId: string; name: string; texts: ({ id: string } & ChatTextState)[] }[];
  history?: { role: 'user' | 'assistant'; text: string }[];
}

export interface ChatEditChange {
  frameId: string;
  frameName: string;
  elementId: string;
  before: ChatTextState;
  after: Partial<ChatTextState>;
}

export interface ChatEditResult {
  reply: string;
  changes: ChatEditChange[];
  followUps: string[];
  /** 새로 생긴 근거 없는 주장 (산지직송·인증 등) */
  warnings: string[];
}
