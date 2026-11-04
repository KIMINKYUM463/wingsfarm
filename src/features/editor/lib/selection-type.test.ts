import '../../../server/testing/resolveHook.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import type { KonvaElement } from '@/shared/types/konva';
import { getSelectionType } from './selection-type';

const el = (props: Record<string, unknown>) => props as unknown as KonvaElement;

describe('선택 패널 타입', () => {
  it('사진이 아직 없는 _image 자리도 이미지 패널을 연다', () => {
    const slot = el({ id: 's', type: 'rect', name: 'hero_image' });
    const type = getSelectionType([{ id: 's', type: 'rect' }], (id) => (id === 's' ? slot : undefined));
    assert.equal(type, TOGGLE_STATES.IMAGE);
  });

  it('박힌 그래픽은 그래픽 패널을 연다', () => {
    const graphic = el({ id: 'g', type: 'rect', name: '_graphic', assetId: 'tpl-1' });
    const type = getSelectionType([{ id: 'g', type: 'rect' }], (id) => (id === 'g' ? graphic : undefined));
    assert.equal(type, TOGGLE_STATES.GRAPHIC_EDIT);
  });
});
