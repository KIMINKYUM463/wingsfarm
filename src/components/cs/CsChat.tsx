"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { RobotAvatar } from "@/components/RobotAvatar";
import { CS_BOT_NAME } from "@/lib/brand";
import { Select } from "@/components/ui";
import { CS_GREETING, CS_TONES, resultToTurnText, type CsChatRequest, type CsChatTurn, type CsResult, type CsTone } from "@/lib/csAi";
import { uid } from "@/lib/format";
import { toResizedDataUrl } from "@/lib/image";
import { useAppStore } from "@/store/useAppStore";
import { CsReplyBubble } from "./CsReplyBubble";

const MAX_IMAGES = 4;
/** API로 보내는 최근 대화 수 (서버 제한 30) */
const MAX_TURNS = 20;

type ConversationItem = { id: string; role: "user"; text: string; images: string[] } | { id: string; role: "assistant"; result: CsResult };
type ChatItem = ConversationItem | { id: string; role: "error"; text: string };

const isConversation = (item: ChatItem): item is ConversationItem => item.role !== "error";

/** 화면 대화를 API 형식으로 변환. 이미지는 가장 최근에 보낸 캡처만 다시 보낸다 */
function toTurns(items: ChatItem[]): CsChatTurn[] {
  const history = items.filter(isConversation).slice(-MAX_TURNS);
  const lastImageIndex = history.findLastIndex((i) => i.role === "user" && i.images.length > 0);
  return history.map((item, index) => {
    if (item.role === "assistant") return { role: "assistant", text: resultToTurnText(item.result) };
    if (index === lastImageIndex) return { role: "user", text: item.text, images: item.images };
    const note = item.images.length > 0 ? `\n(캡처 ${item.images.length}장 첨부했었음)` : "";
    return { role: "user", text: item.text + note };
  });
}

function BotRow({ children, thinking = false }: { children: ReactNode; thinking?: boolean }) {
  return (
    <div className="flex animate-fade-up items-start gap-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#07140f] ring-2 ring-emerald-100">
        <RobotAvatar size={26} thinking={thinking} />
      </div>
      <div className="min-w-0 max-w-[min(100%,44rem)] rounded-2xl rounded-tl-md border border-stone-200 bg-white px-4 py-3 shadow-sm">{children}</div>
    </div>
  );
}

function Thumbs({ images, onRemove }: { images: string[]; onRemove?: (index: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((src, i) => (
        <div key={i} className="group relative size-20 overflow-hidden rounded-lg border border-white/30 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 data URL 미리보기 */}
          <img src={src} alt={`캡처 ${i + 1}`} className="size-full object-cover" />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-[10px] text-white"
              aria-label="삭제"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function CsChat() {
  const { skus, csPolicy, csTone, setCsSettings } = useAppStore();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const addFiles = useCallback(async (files: Blob[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    try {
      const urls = await Promise.all(images.map((f) => toResizedDataUrl(f)));
      setAttachments((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
      setAttachError("");
    } catch {
      setAttachError("이미지를 불러오지 못했습니다. PNG·JPG 캡처인지 확인해 주세요.");
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [items, pending]);

  const request = async (history: ChatItem[]) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    try {
      const body: CsChatRequest = {
        messages: toTurns(history),
        tone: csTone,
        policy: csPolicy,
        products: skus.map((s) => ({ id: s.id, name: `${s.productName} ${s.optionName}` })),
      };
      const res = await fetch("/api/cs-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "답변을 만들지 못했습니다.");
      setItems((cur) => [...cur, { id: uid(), role: "assistant", result: data }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      const text = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setItems((cur) => [...cur, { id: uid(), role: "error", text }]);
    } finally {
      if (controllerRef.current === controller) setPending(false);
    }
  };

  const send = (text: string, images: string[] = []) => {
    const trimmed = text.trim();
    if (pending || (!trimmed && images.length === 0)) return;
    const next: ChatItem[] = [...items.filter(isConversation), { id: uid(), role: "user", text: trimmed, images }];
    setItems(next);
    setDraft("");
    setAttachments([]);
    void request(next);
  };

  const retry = () => {
    const history = items.filter(isConversation);
    setItems(history);
    void request(history);
  };

  const reset = () => {
    controllerRef.current?.abort();
    setItems([]);
    setDraft("");
    setAttachments([]);
    setPending(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중 Enter는 글자 확정용이라 전송하지 않는다
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft, attachments);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const lastAssistantId = items.findLast((i) => i.role === "assistant")?.id;
  const canSend = !pending && (draft.trim() !== "" || attachments.length > 0);

  return (
    <section
      className="relative flex h-[calc(100vh-10rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-sm"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-5 py-3">
        <div className="grid size-10 place-items-center rounded-full bg-[#07140f]">
          <RobotAvatar size={30} thinking={pending} />
        </div>
        <div className="mr-auto">
          <p className="font-bold text-stone-900">{CS_BOT_NAME}</p>
          <p className="flex items-center gap-1 text-xs text-stone-500">
            <span className={`size-1.5 rounded-full ${pending ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
            {pending ? "답변 작성 중" : "대기 중"}
          </p>
        </div>
        <Select className="w-auto text-xs" value={csTone} onChange={(e) => setCsSettings({ csTone: e.target.value as CsTone })} aria-label="답변 말투">
          {Object.entries(CS_TONES).map(([key, label]) => (
            <option key={key} value={key}>
              {label.split(" (")[0]}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setShowPolicy((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-xs transition ${showPolicy ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}
        >
          보상 정책
        </button>
        {items.length > 0 && (
          <button type="button" onClick={reset} className="rounded-lg px-3 py-2 text-xs text-stone-500 transition hover:bg-stone-100">
            ↻ 새 대화
          </button>
        )}
      </header>

      {showPolicy && (
        <div className="animate-fade-in border-b border-stone-200 bg-white px-5 py-3">
          <p className="mb-1.5 text-xs text-stone-500">AI는 이 정책 범위 안에서만 보상을 약속합니다.</p>
          <textarea
            value={csPolicy}
            onChange={(e) => setCsSettings({ csPolicy: e.target.value })}
            rows={6}
            className="w-full rounded-lg border border-stone-300 p-3 text-xs leading-relaxed outline-none focus:border-emerald-500"
          />
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <BotRow>
          <p className="text-sm font-medium text-stone-900">{CS_GREETING}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
            고객 문의 캡처를 <kbd className="rounded bg-stone-100 px-1 py-0.5">Ctrl</kbd>+<kbd className="rounded bg-stone-100 px-1 py-0.5">V</kbd>로 붙여넣거나, 문의
            내용을 그대로 적어 주세요. 문의를 분석해서 고객에게 보낼 답변을 만들어 드릴게요.
          </p>
        </BotRow>

        {items.map((item) =>
          item.role === "user" ? (
            <div key={item.id} className="flex animate-fade-up justify-end">
              <div className="max-w-[min(85%,36rem)] space-y-2 rounded-2xl rounded-tr-md bg-emerald-600 px-4 py-3 text-white shadow-sm">
                {item.images.length > 0 && <Thumbs images={item.images} />}
                {item.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.text}</p>}
              </div>
            </div>
          ) : item.role === "assistant" ? (
            <BotRow key={item.id}>
              <CsReplyBubble result={item.result} skus={skus} onFollowUp={item.id === lastAssistantId && !pending ? (text) => send(text) : undefined} />
            </BotRow>
          ) : (
            <BotRow key={item.id}>
              <p className="text-sm text-rose-600">{item.text}</p>
              <button type="button" onClick={retry} className="mt-2 text-xs font-medium text-emerald-700 hover:underline">
                ↻ 다시 시도
              </button>
            </BotRow>
          ),
        )}

        {pending && (
          <BotRow thinking>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </span>
              문의를 읽고 답변을 쓰고 있어요
            </div>
          </BotRow>
        )}
      </div>

      <footer className="border-t border-stone-200 bg-white px-4 py-3">
        {attachments.length > 0 && (
          <div className="mb-2">
            <Thumbs images={attachments} onRemove={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))} />
          </div>
        )}
        {attachError && <p className="mb-2 text-xs text-rose-600">{attachError}</p>}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={attachments.length >= MAX_IMAGES}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-stone-300 text-lg text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
            aria-label="캡처 첨부"
            title={`캡처 첨부 (최대 ${MAX_IMAGES}장)`}
          >
            📎
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="고객 문의를 붙여넣거나 캡처를 올려 주세요 (Enter 전송 · Shift+Enter 줄바꿈)"
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-stone-300 px-4 py-2.5 text-sm leading-relaxed outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => send(draft, attachments)}
            disabled={!canSend}
            className="h-11 shrink-0 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400"
          >
            보내기
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-stone-400">AI가 작성한 답변입니다. 보내기 전에 금액·일정이 맞는지 한 번 확인해 주세요.</p>
      </footer>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-emerald-50/90 text-sm font-semibold text-emerald-700 ring-2 ring-inset ring-emerald-400">
          여기에 캡처를 놓으세요
        </div>
      )}
    </section>
  );
}
