import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitTextToBox } from '../templates/nodes';
import { hasBakedTemplatePhotos, looksLikePhotoSlot, promotePhotoSlots, type PhotoSlotNode } from './photoSlots';

const node = (props: Partial<PhotoSlotNode> & { type: string }): PhotoSlotNode => ({ ...props });

describe('템플릿 사진 자리', () => {
  it('큰 템플릿 사진은 사진 자리로 보고, 작은 아이콘은 보지 않는다', () => {
    assert.equal(looksLikePhotoSlot(node({ type: 'rect', width: 400, height: 300, figmaImageRef: 'abc' })), true);
    assert.equal(looksLikePhotoSlot(node({ type: 'rect', width: 400, height: 300, assetId: 'tpl-abc' })), true);
    assert.equal(looksLikePhotoSlot(node({ type: 'rect', width: 32, height: 32, figmaImageRef: 'icon' })), false);
    assert.equal(looksLikePhotoSlot(node({ type: 'rect', name: '_graphic', width: 400, height: 300, assetId: 'tpl-g' })), false);
  });

  it('박힌 큰 사진을 비우고 _image 자리로 바꾼다', () => {
    const frame = node({
      type: 'frame',
      children: [node({ type: 'rect', name: 'image 12', width: 860, height: 500, figmaImageRef: 'tick' })],
    });
    promotePhotoSlots(frame);
    const photo = frame.children![0];
    assert.ok(String(photo.name).includes('_image'));
    assert.equal(photo.figmaImageRef, undefined);
    assert.equal(photo.assetId, undefined);
  });

  it('박힌 큰 사진이 있으면 그 템플릿은 제외하고, 빈 사진 자리만 있으면 둔다', () => {
    const baked = node({
      type: 'frame',
      children: [node({ type: 'rect', name: 'image 12', width: 860, height: 500, figmaImageRef: 'tick' })],
    });
    const slotsOnly = node({
      type: 'frame',
      children: [
        node({ type: 'rect', name: 'hero_image', width: 860, height: 500, figmaImageRef: 'sample' }),
        node({ type: 'rect', name: 'badge', width: 48, height: 48, figmaImageRef: 'star' }),
        node({ type: 'rect', name: 'deco_graphic', width: 400, height: 200, assetId: 'tpl-leaf' }),
      ],
    });
    assert.equal(hasBakedTemplatePhotos(baked), true);
    assert.equal(hasBakedTemplatePhotos(slotsOnly), false);
  });

  it('작은 장식 이미지는 사진 자리로 바꾸지 않는다', () => {
    const icon = node({ type: 'rect', name: 'badge', width: 48, height: 48, figmaImageRef: 'star' });
    assert.equal(looksLikePhotoSlot(icon), false);
    promotePhotoSlots(icon);
    assert.equal(icon.figmaImageRef, 'star');
  });

});

describe('글자 칸 맞추기', () => {
  it('한 줄 칸보다 긴 제목은 글자를 줄여 잘리지 않게 한다', () => {
    const title = {
      type: 'text',
      id: 't',
      text: '먹기 좋게 다듬어서 보내요',
      width: 280,
      height: 48,
      fontSize: 40,
      wrap: 'none' as const,
    };
    fitTextToBox(title);
    assert.notEqual(title.wrap, 'none');
    assert.ok(Number(title.fontSize) < 40);
  });
});
