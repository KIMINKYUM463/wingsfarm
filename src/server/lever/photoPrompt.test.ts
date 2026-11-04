import '../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { distinctFrom, keywordPhotoPrompt, photoPromptFor, productPhotoPrompt, sceneForIndex } = await import('./photoPrompt.ts');
const { sceneIdeas } = await import('../../shared/lib/draftMedia.ts');

describe('AI 상품 사진 프롬프트', () => {
  it('사진 한 장만, 글씨 금지 규칙을 맨 뒤에 둔다', () => {
    const prompt = productPhotoPrompt('Product name (Korean): 성주 참외', false, null, undefined, 0, 'Scene (Korean): 식탁 위 플레이팅');
    const lines = prompt.split('\n');
    assert.match(lines[0], /ONE new real-camera photograph/);
    assert.match(prompt, /not a web page, detail page, poster/);
    assert.match(lines.at(-1)!, /Absolutely no added text/);
    assert.ok(lines.includes('Product name (Korean): 성주 참외'));
    assert.ok(!lines.some((l) => l === 'false' || l === '0' || l === ''));
    assert.doesNotMatch(prompt, /for a Korean e-commerce detail page/);
  });

  it('사진이 없으면 키워드만으로 장면을 만들라고 한다', () => {
    const prompt = keywordPhotoPrompt('Product name (Korean): 영덕 과메기', 'Keywords (Korean): 청어, 그늘 건조');
    assert.match(prompt, /no reference photos/i);
    assert.match(prompt, /영덕 과메기/);
    assert.match(prompt, /Absolutely no added text/);
    assert.equal(photoPromptFor(false, 'Scene: 산지'), keywordPhotoPrompt('Scene: 산지'));
    assert.equal(photoPromptFor(true, 'Scene: 산지'), productPhotoPrompt('Scene: 산지'));
  });

  it('다른 사진 장면은 중복·빈 값을 빼고 알려 준다', () => {
    assert.equal(distinctFrom([]), null);
    assert.equal(distinctFrom([' ', '']), null);
    assert.match(distinctFrom(['단면', '단면', '산지 풍경'])!, /show: 단면 \/ 산지 풍경\./);
  });

  it('사진 순번마다 장면을 돌려 쓴다', () => {
    const ideas = sceneIdeas('agri');
    assert.equal(sceneForIndex('agri', 0), ideas[0]);
    assert.equal(sceneForIndex('agri', 1), ideas[1]);
    assert.equal(sceneForIndex('agri', ideas.length), ideas[0]);
    assert.equal(sceneForIndex('agri', -1), ideas.at(-1));
    assert.equal(sceneForIndex('unknown', 0), sceneIdeas('unknown')[0]);
  });
});
