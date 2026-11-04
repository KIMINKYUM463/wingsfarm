'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { derivePalette, HEX_COLOR, PALETTE_ROLES, TONE_PRESETS } from '@/shared/lib/palette';
import type { DraftPalette, PalettePreset } from '@/shared/types/draft';

/**
 * 4색 팔레트 편집 (초안 "색 바꾸기"와 에디터 "색상" 탭이 함께 사용)
 * - 추천 조합(프리셋) · 톤 · 역할별 직접 고르기 · "대표색에 맞춤"
 */
export function PalettePanel({
  palette,
  onChange,
  reason,
  presets,
  onShuffle,
  shuffling,
}: {
  palette: DraftPalette;
  onChange: (palette: DraftPalette) => void;
  reason?: string;
  presets?: PalettePreset[];
  onShuffle?: () => void;
  shuffling?: boolean;
}) {
  const [linked, setLinked] = useState(true);
  const same = (a: DraftPalette, b: DraftPalette) => a.main === b.main && a.point === b.point && a.bgLight === b.bgLight && a.bgDark === b.bgDark;

  const setRole = (role: keyof DraftPalette, value: string) => {
    if (!HEX_COLOR.test(value)) return;
    onChange(role === 'main' && linked ? derivePalette(value) : { ...palette, [role]: value.toUpperCase() });
  };

  return (
    <div className="flex flex-col gap-4">
      {reason && <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">🎨 {reason}</div>}

      {presets && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">추천 조합</span>
            {onShuffle && (
              <button type="button" className="text-xs font-semibold text-(--color-point)" disabled={shuffling} onClick={onShuffle}>
                {shuffling ? '찾는 중…' : '↻ 다른 조합 받기'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <PaletteSwatch key={Object.values(preset.palette).join()} palette={preset.palette} label={preset.reason} selected={same(preset.palette, palette)} onClick={() => onChange(preset.palette)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-500">톤</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TONE_PRESETS.map((tone) => {
            const p = derivePalette(tone.main);
            return <PaletteSwatch key={tone.id} palette={p} label={tone.name} selected={same(p, palette)} onClick={() => onChange(p)} compact />;
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">직접 고르기</span>
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-[11px]">
            <button type="button" className={clsx('px-2 py-1', linked ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')} onClick={() => setLinked(true)}>
              대표색에 맞춤
            </button>
            <button type="button" className={clsx('px-2 py-1', !linked ? 'bg-gray-900 text-white' : 'bg-white text-gray-500')} onClick={() => setLinked(false)}>
              직접 고르기
            </button>
          </div>
        </div>
        {PALETTE_ROLES.map(({ role, label, description }) => (
          <label key={role} className={clsx('flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2', linked && role !== 'main' && 'opacity-60')}>
            <input
              type="color"
              value={palette[role]}
              disabled={linked && role !== 'main'}
              onChange={(e) => setRole(role, e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-gray-900">
                {label} <span className="font-mono text-xs font-normal text-gray-400">{palette[role]}</span>
              </span>
              <span className="text-xs text-gray-500">{description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PaletteSwatch({ palette, label, selected, onClick, compact }: { palette: DraftPalette; label: string; selected: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={clsx('flex flex-col gap-1 rounded-lg border p-1.5 text-left font-normal', selected ? 'border-(--color-point) ring-1 ring-(--color-point)' : 'border-gray-100 hover:border-gray-300')}
    >
      <span className="flex h-6 overflow-hidden rounded">
        {(['main', 'point', 'bgDark', 'bgLight'] as const).map((role) => (
          <span key={role} className="flex-1" style={{ background: palette[role] }} />
        ))}
      </span>
      <span className={clsx('truncate text-gray-600', compact ? 'text-[11px]' : 'text-xs')}>{label}</span>
    </button>
  );
}
