'use client';

import clsx from 'clsx';
import { useEffect } from 'react';
import { loadFont } from '@/features/editor/lib/font-loader';
import { DESIGN_STYLE_OPTIONS, type DesignStyleId, type DesignStyleOption } from '@/shared/lib/designStyles';
import { derivePalette, TONE_PRESETS } from '@/shared/lib/palette';
import type { DraftPalette } from '@/shared/types/draft';

/** 스타일 카드의 축소 견본 — 첫 화면(히어로) 느낌만 보여 준다 */
const MOCK: Record<DesignStyleId, { bg: keyof DraftPalette | 'white'; align: 'left' | 'center'; label: 'text' | 'pill' | 'rule'; weight: number; radius: number }> = {
  modern: { bg: 'white', align: 'left', label: 'text', weight: 800, radius: 8 },
  natural: { bg: 'bgLight', align: 'center', label: 'rule', weight: 800, radius: 14 },
  premium: { bg: 'main', align: 'center', label: 'rule', weight: 700, radius: 0 },
  pop: { bg: 'bgDark', align: 'center', label: 'pill', weight: 900, radius: 12 },
};

export function DesignStylePanel({
  value,
  palette,
  onChange,
  onApplyTone,
}: {
  value: DesignStyleId;
  palette: DraftPalette;
  onChange: (id: DesignStyleId) => void;
  onApplyTone: (palette: DraftPalette) => void;
}) {
  useEffect(() => {
    for (const s of DESIGN_STYLE_OPTIONS) if (s.headingFont !== 'Pretendard') void loadFont(s.headingFont, '700').catch(() => undefined);
  }, []);
  const selected = DESIGN_STYLE_OPTIONS.find((s) => s.id === value)!;
  const tone = TONE_PRESETS.find((t) => t.id === selected.toneId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">같은 구성과 문구로 글꼴·정렬·바탕·카드 모양만 바뀌어요. 색은 &quot;색 바꾸기&quot;에서 따로 고를 수 있어요.</p>
      <div className="grid grid-cols-2 gap-3">
        {DESIGN_STYLE_OPTIONS.map((style) => (
          <StyleCard key={style.id} style={style} palette={palette} selected={style.id === value} onClick={() => onChange(style.id)} />
        ))}
      </div>
      {tone && (
        <button type="button" className="btn-outline flex items-center justify-center gap-2 text-sm" onClick={() => onApplyTone(derivePalette(tone.main))}>
          <span className="h-4 w-4 rounded-full" style={{ background: tone.main }} />
          {selected.name}에 어울리는 {tone.name} 색으로 바꾸기
        </button>
      )}
    </div>
  );
}

function StyleCard({ style, palette, selected, onClick }: { style: DesignStyleOption; palette: DraftPalette; selected: boolean; onClick: () => void }) {
  const mock = MOCK[style.id];
  const dark = mock.bg === 'main';
  const accent = dark ? palette.point : palette.main;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx('flex flex-col overflow-hidden rounded-xl border text-left transition', selected ? 'border-(--color-point) ring-2 ring-(--color-point)/30' : 'border-gray-200 hover:border-gray-300')}
    >
      <div className="flex h-28 flex-col justify-center gap-1.5 px-4" style={{ background: mock.bg === 'white' ? '#fff' : palette[mock.bg], textAlign: mock.align }}>
        {mock.label === 'pill' ? (
          <span className={clsx('w-fit rounded-full px-2 py-0.5 text-[10px] font-bold text-white', mock.align === 'center' && 'mx-auto')} style={{ background: palette.main }}>
            BEST
          </span>
        ) : (
          <span className="text-[10px] font-bold tracking-widest" style={{ color: accent }}>
            {mock.label === 'rule' && <span className={clsx('mb-1 block h-px w-5', mock.align === 'center' && 'mx-auto')} style={{ background: accent }} />}
            BRAND
          </span>
        )}
        <span className="text-lg leading-tight" style={{ fontFamily: `'${style.headingFont}', Pretendard, sans-serif`, fontWeight: mock.weight, color: dark ? '#fff' : '#111827' }}>
          가을 제철 꽃게
        </span>
        <span
          className={clsx('mt-1 h-5 w-16', mock.align === 'center' && 'mx-auto')}
          style={{ borderRadius: mock.radius, background: dark ? 'rgba(255,255,255,0.15)' : mock.bg === 'white' ? palette.bgLight : '#fff' }}
        />
      </div>
      <div className="flex flex-col gap-0.5 border-t border-gray-100 bg-white px-3 py-2">
        <span className="text-sm font-semibold text-gray-900">
          {style.name}
          {selected && <span className="ml-1 text-xs text-(--color-point)">· 선택됨</span>}
        </span>
        <span className="text-xs leading-4 text-gray-500">{style.description}</span>
      </div>
    </button>
  );
}
