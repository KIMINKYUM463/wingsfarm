import { create } from 'zustand';
import type { ChatEditResult } from '@/shared/types/chatEdit';

/**
 * 에디터 AI 채팅 상태
 * - 실행 중에 보낸 요청은 대기열(queued)에 쌓였다가 순서대로 처리된다
 * - 패널을 닫아도 대화는 유지되고, "새 대화"로 비운다
 */
export type ChatStatus = 'queued' | 'running' | 'done' | 'error';

export interface ChatTurn {
  id: string;
  message: string;
  /** 보낼 때 고른 범위 (null이면 문서 전체) */
  scopeFrameId: string | null;
  scopeName: string | null;
  status: ChatStatus;
  result?: ChatEditResult;
  error?: string;
  reverted?: boolean;
}

interface AiChatState {
  open: boolean;
  turns: ChatTurn[];
  setOpen: (open: boolean) => void;
  enqueue: (turn: Pick<ChatTurn, 'message' | 'scopeFrameId' | 'scopeName'>) => void;
  updateTurn: (id: string, patch: Partial<ChatTurn>) => void;
  reset: () => void;
}

export const useAiChatStore = create<AiChatState>()((set) => ({
  open: false,
  turns: [],
  setOpen: (open) => set({ open }),
  enqueue: (turn) => set((state) => ({ turns: [...state.turns, { ...turn, id: crypto.randomUUID(), status: 'queued' }] })),
  updateTurn: (id, patch) => set((state) => ({ turns: state.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  reset: () => set((state) => ({ turns: state.turns.filter((t) => t.status === 'running') })),
}));
