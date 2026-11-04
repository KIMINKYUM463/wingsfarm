import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasBakedTemplatePhotos, looksLikePhotoSlot, promotePhotoSlots, type PhotoSlotNode } from './photoSlots.ts';

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

  it('판매자·AI가 넣은 사진은 에디터 조회 때 지우지 않는다', () => {
    const sellerId = '34033987-c064-4f52-b469-4b97248a432a';
    const frame = node({
      type: 'frame',
      children: [
        node({ type: 'rect', name: 'hero_image', width: 860, height: 500, assetId: sellerId }),
        node({ type: 'rect', name: 'detail_image', width: 400, height: 300, assetId: 'tpl-sample', figmaImageRef: 'old' }),
      ],
    });
    promotePhotoSlots(frame);
    assert.equal(frame.children![0].assetId, sellerId);
    assert.equal(frame.children![1].assetId, undefined);
    assert.equal(frame.children![1].figmaImageRef, undefined);
    assert.ok(String(frame.children![1].name).includes('_image'));
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
});
