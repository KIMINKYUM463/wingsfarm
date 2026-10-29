"use client";

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Button, TextInput } from "@/components/ui";

type LayerBase = { id: string; x: number; y: number }; // x,y = 캔버스 % (0~100), 중심 기준

type TextLayer = LayerBase & {
  kind: "text";
  text: string;
  fontSize: number; // 캔버스 너비 대비 %
  color: string;
  bold: boolean;
  shadow: boolean;
};

type BannerLayer = LayerBase & {
  kind: "banner";
  text: string;
  width: number; // %
  height: number; // %
  bg: string;
  color: string;
  fontSize: number;
  radius: number;
};

type BadgeLayer = LayerBase & {
  kind: "badge";
  label: string;
  bg: string;
  color: string;
  scale: number;
};

type Layer = TextLayer | BannerLayer | BadgeLayer;

const COLORS = ["#ffffff", "#07140f", "#fbbf24", "#ef4444", "#10b981", "#3b82f6", "#f97316", "#ec4899"];

const BADGE_PRESETS: { label: string; bg: string; color: string }[] = [
  { label: "산지직송", bg: "#07140f", color: "#fde68a" },
  { label: "오늘수확", bg: "#059669", color: "#ffffff" },
  { label: "선물추천", bg: "#be123c", color: "#ffffff" },
  { label: "특가", bg: "#ea580c", color: "#ffffff" },
  { label: "한정수량", bg: "#7c3aed", color: "#ffffff" },
  { label: "당일출고", bg: "#1d4ed8", color: "#ffffff" },
];

const BANNER_PRESETS: { label: string; bg: string; color: string; text: string }[] = [
  { label: "하단 띠", bg: "#07140f", color: "#fde68a", text: "산지에서 바로 보내드려요" },
  { label: "상단 띠", bg: "#be123c", color: "#ffffff", text: "지금 가장 맛있을 때" },
  { label: "세일 띠", bg: "#ea580c", color: "#ffffff", text: "기간 한정 특가" },
];

function uid() {
  return `L${Math.random().toString(36).slice(2, 9)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

/** 레이어를 캔버스에 그려 PNG data URL로 반환 */
async function exportComposite(imageSrc: string, layers: Layer[]): Promise<string> {
  const img = await loadImage(imageSrc);
  const size = Math.max(img.naturalWidth, img.naturalHeight, 1024);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // cover fit
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

  const fontFamily = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  for (const layer of layers) {
    const cx = (layer.x / 100) * size;
    const cy = (layer.y / 100) * size;

    if (layer.kind === "text") {
      const fontPx = (layer.fontSize / 100) * size;
      ctx.font = `${layer.bold ? 800 : 600} ${fontPx}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (layer.shadow) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillText(layer.text, cx + fontPx * 0.04, cy + fontPx * 0.04);
      }
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, cx, cy);
    }

    if (layer.kind === "banner") {
      const w = (layer.width / 100) * size;
      const h = (layer.height / 100) * size;
      const x = cx - w / 2;
      const y = cy - h / 2;
      const r = Math.min((layer.radius / 100) * size, h / 2);
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = layer.bg;
      ctx.fill();
      const fontPx = (layer.fontSize / 100) * size;
      ctx.font = `700 ${fontPx}px ${fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text, cx, cy);
    }

    if (layer.kind === "badge") {
      const fontPx = (4.2 * layer.scale) * (size / 100);
      ctx.font = `800 ${fontPx}px ${fontFamily}`;
      const padX = fontPx * 0.55;
      const padY = fontPx * 0.35;
      const metrics = ctx.measureText(layer.label);
      const w = metrics.width + padX * 2;
      const h = fontPx + padY * 2;
      const x = cx - w / 2;
      const y = cy - h / 2;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = layer.bg;
      ctx.fill();
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.label, cx, cy);
    }
  }

  return canvas.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ThumbnailEditor({
  image,
  title,
  onClose,
  onApply,
}: {
  image: string;
  title: string;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const labelId = useId();

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setLayers((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, selectedId]);

  const updateLayer = <T extends Layer>(id: string, patch: Partial<T>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));
  };

  const addText = () => {
    const layer: TextLayer = {
      id: uid(),
      kind: "text",
      text: "상품명 한 줄",
      x: 50,
      y: 18,
      fontSize: 7,
      color: "#ffffff",
      bold: true,
      shadow: true,
    };
    setLayers((p) => [...p, layer]);
    setSelectedId(layer.id);
  };

  const addBanner = (preset = BANNER_PRESETS[0]) => {
    const layer: BannerLayer = {
      id: uid(),
      kind: "banner",
      text: preset.text,
      x: 50,
      y: preset.label.includes("상단") ? 10 : 88,
      width: 100,
      height: 12,
      bg: preset.bg,
      color: preset.color,
      fontSize: 4.5,
      radius: 0,
    };
    setLayers((p) => [...p, layer]);
    setSelectedId(layer.id);
  };

  const addBadge = (preset: (typeof BADGE_PRESETS)[number]) => {
    const layer: BadgeLayer = {
      id: uid(),
      kind: "badge",
      label: preset.label,
      bg: preset.bg,
      color: preset.color,
      x: 18,
      y: 18,
      scale: 1,
    };
    setLayers((p) => [...p, layer]);
    setSelectedId(layer.id);
  };

  const onPointerDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    setSelectedId(id);
    dragRef.current = {
      id,
      ox: ((e.clientX - rect.left) / rect.width) * 100 - layer.x,
      oy: ((e.clientY - rect.top) / rect.height) * 100 - layer.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onLayerClick = (e: ReactMouseEvent) => {
    e.stopPropagation(); // 배경 클릭으로 선택 해제되지 않게
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const { id, ox, oy } = dragRef.current;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100 - ox));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100 - oy));
    updateLayer(id, { x, y });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleApply = useCallback(async () => {
    setSaving(true);
    try {
      const dataUrl = await exportComposite(image, layers);
      onApply(dataUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [image, layers, onApply]);

  const handleDownload = async () => {
    setSaving(true);
    try {
      const dataUrl = await exportComposite(image, layers);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title || "thumbnail"}-edited.png`;
      a.click();
    } catch (err) {
      alert(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-[#07140f]/60 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="flex max-h-[94vh] w-full max-w-6xl animate-pop-in flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-5 py-3.5">
          <div>
            <p className="text-[11px] font-medium tracking-[0.25em] text-stone-400 uppercase">썸네일 편집</p>
            <h2 id={labelId} className="text-lg font-bold text-stone-900">
              {title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={handleDownload} disabled={saving}>
              다운로드
            </Button>
            <Button onClick={handleApply} disabled={saving}>
              {saving ? "저장 중…" : "적용하기"}
            </Button>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full bg-stone-200/80 text-stone-600 transition hover:bg-stone-300"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_300px]">
          {/* 캔버스 */}
          <div className="flex items-center justify-center bg-stone-200/60 p-4 sm:p-6">
            <div
              ref={stageRef}
              className="relative aspect-square w-full max-w-[min(72vh,560px)] touch-none overflow-hidden rounded-2xl bg-stone-900 shadow-xl ring-1 ring-black/10 [container-type:size]"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={(e) => {
                // 빈 배경만 선택 해제 — 레이어에서 올라온 click은 무시
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="pointer-events-none absolute inset-0 size-full object-cover select-none" draggable={false} />

              {layers.map((layer) => {
                const active = layer.id === selectedId;
                const common = `absolute -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing ${
                  active ? "z-20 ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent" : "z-10"
                }`;

                if (layer.kind === "text") {
                  return (
                    <div
                      key={layer.id}
                      className={common}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        color: layer.color,
                        fontSize: `${layer.fontSize}cqw`,
                        fontWeight: layer.bold ? 800 : 600,
                        textShadow: layer.shadow ? "0 2px 8px rgba(0,0,0,0.55)" : undefined,
                        whiteSpace: "nowrap",
                        lineHeight: 1.1,
                      }}
                      onPointerDown={(e) => onPointerDown(e, layer.id)}
                      onClick={onLayerClick}
                    >
                      {layer.text || "텍스트"}
                    </div>
                  );
                }

                if (layer.kind === "banner") {
                  return (
                    <div
                      key={layer.id}
                      className={`${common} flex items-center justify-center px-2 text-center font-bold`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        width: `${layer.width}%`,
                        height: `${layer.height}%`,
                        background: layer.bg,
                        color: layer.color,
                        fontSize: `${layer.fontSize}cqw`,
                        borderRadius: `${layer.radius}px`,
                      }}
                      onPointerDown={(e) => onPointerDown(e, layer.id)}
                      onClick={onLayerClick}
                    >
                      <span className="truncate px-1">{layer.text || "배너"}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={layer.id}
                    className={`${common} rounded-full px-[0.7em] py-[0.35em] font-extrabold whitespace-nowrap`}
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      background: layer.bg,
                      color: layer.color,
                      fontSize: `${4.2 * layer.scale}cqw`,
                    }}
                    onPointerDown={(e) => onPointerDown(e, layer.id)}
                    onClick={onLayerClick}
                  >
                    {layer.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 도구 패널 */}
          <aside className="max-h-[min(50vh,420px)] space-y-4 overflow-y-auto border-t border-stone-100 bg-white p-4 lg:max-h-none lg:border-t-0 lg:border-l">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">추가하기</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={addText}>
                  글씨
                </Button>
                <Button variant="secondary" onClick={() => addBanner()}>
                  띠 배너
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">빠른 배지</p>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_PRESETS.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => addBadge(b)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:scale-105"
                    style={{ background: b.bg, color: b.color }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">띠 배너 프리셋</p>
              <div className="flex flex-col gap-1.5">
                {BANNER_PRESETS.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => addBanner(b)}
                    className="rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:opacity-90"
                    style={{ background: b.bg, color: b.color }}
                  >
                    {b.label} · {b.text}
                  </button>
                ))}
              </div>
            </div>

            {selected ? (
              <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-stone-800">
                    {selected.kind === "text" ? "글씨" : selected.kind === "banner" ? "배너" : "배지"} 편집
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setLayers((p) => p.filter((l) => l.id !== selected.id));
                      setSelectedId(null);
                    }}
                  >
                    삭제
                  </Button>
                </div>

                {(selected.kind === "text" || selected.kind === "banner") && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-stone-500">문구</span>
                    <TextInput
                      value={selected.text}
                      onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                      placeholder="문구 입력"
                    />
                  </label>
                )}

                {selected.kind === "badge" && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-stone-500">배지 문구</span>
                    <TextInput value={selected.label} onChange={(e) => updateLayer(selected.id, { label: e.target.value })} />
                  </label>
                )}

                <div>
                  <p className="mb-1.5 text-[11px] text-stone-500">글자색</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateLayer(selected.id, { color: c })}
                        className={`size-7 rounded-full border-2 ${selected.color === c ? "border-emerald-500" : "border-white"} shadow`}
                        style={{ background: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>

                {(selected.kind === "banner" || selected.kind === "badge") && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-stone-500">배경색</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateLayer(selected.id, { bg: c })}
                          className={`size-7 rounded-full border-2 ${selected.bg === c ? "border-emerald-500" : "border-white"} shadow`}
                          style={{ background: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selected.kind === "text" && (
                  <>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[11px] text-stone-500">
                        크기 <span>{selected.fontSize.toFixed(1)}</span>
                      </span>
                      <input
                        type="range"
                        min={3}
                        max={16}
                        step={0.5}
                        value={selected.fontSize}
                        onChange={(e) => updateLayer(selected.id, { fontSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateLayer(selected.id, { bold: !selected.bold })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${selected.bold ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-200"}`}
                      >
                        굵게
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(selected.id, { shadow: !selected.shadow })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${selected.shadow ? "bg-stone-900 text-white" : "bg-white ring-1 ring-stone-200"}`}
                      >
                        그림자
                      </button>
                    </div>
                  </>
                )}

                {selected.kind === "banner" && (
                  <>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[11px] text-stone-500">
                        높이 <span>{selected.height}%</span>
                      </span>
                      <input
                        type="range"
                        min={6}
                        max={24}
                        value={selected.height}
                        onChange={(e) => updateLayer(selected.id, { height: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[11px] text-stone-500">
                        글자 크기 <span>{selected.fontSize}</span>
                      </span>
                      <input
                        type="range"
                        min={2.5}
                        max={8}
                        step={0.5}
                        value={selected.fontSize}
                        onChange={(e) => updateLayer(selected.id, { fontSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </label>
                  </>
                )}

                {selected.kind === "badge" && (
                  <label className="block">
                    <span className="mb-1 flex justify-between text-[11px] text-stone-500">
                      크기 <span>{selected.scale.toFixed(1)}x</span>
                    </span>
                    <input
                      type="range"
                      min={0.7}
                      max={2}
                      step={0.1}
                      value={selected.scale}
                      onChange={(e) => updateLayer(selected.id, { scale: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
                오른쪽에서 글씨·배너·배지를 추가한 뒤, 사진 위에서 드래그로 위치를 옮기세요. 선택한 요소는 여기서 문구·색·크기를 바꿀 수 있습니다.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
