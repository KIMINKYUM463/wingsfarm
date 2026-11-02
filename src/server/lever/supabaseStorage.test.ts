import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStorage, isMissing } from './supabaseStorage.ts';

const config = { url: 'https://demo.supabase.co', key: 'test-key', bucket: 'detail-page' };

/** 요청을 기록하고, 정해 둔 응답을 차례로 돌려주는 가짜 fetch */
function fakeFetch(responses: Response[]) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body });
    const next = responses.shift();
    if (!next) throw new Error(`예상하지 못한 요청: ${url}`);
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const notFound = () => new Response(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }), { status: 400 });

describe('Supabase 저장소', () => {
  it('없는 파일·버킷 응답을 구분한다', () => {
    assert.equal(isMissing(404, ''), true);
    assert.equal(isMissing(400, '{"statusCode":"404","error":"Bucket not found"}'), true);
    assert.equal(isMissing(400, '{"statusCode":"400","error":"invalid"}'), false);
    assert.equal(isMissing(500, 'not found'), false);
  });

  it('읽기: 있으면 내용, 없으면 null', async () => {
    const { impl, calls } = fakeFetch([new Response('{"a":1}'), notFound()]);
    const storage = createSupabaseStorage(config, impl);
    assert.equal((await storage.read('projects/한글 이름.json'))?.toString(), '{"a":1}');
    assert.equal(await storage.read('projects/none.json'), null);
    assert.equal(calls[0].url, 'https://demo.supabase.co/storage/v1/object/authenticated/detail-page/projects/%ED%95%9C%EA%B8%80%20%EC%9D%B4%EB%A6%84.json');
  });

  it('쓰기: 버킷이 없으면 만들고 다시 저장한다', async () => {
    const { impl, calls } = fakeFetch([notFound(), new Response('{}'), new Response('{}')]);
    await createSupabaseStorage(config, impl).write('settings.json', '{}');
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.url.replace('https://demo.supabase.co/storage/v1', '')}`),
      ['POST /object/detail-page/settings.json', 'POST /bucket', 'POST /object/detail-page/settings.json'],
    );
    assert.equal(JSON.parse(String(calls[1].body)).public, false);
  });

  it('목록: 하위 폴더는 빼고 1000개씩 끝까지 읽는다', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ name: `${i}.json`, id: `id${i}` }));
    const page2 = [{ name: 'last.json', id: 'x' }, { name: 'sub', id: null }];
    const { impl, calls } = fakeFetch([Response.json(page1), Response.json(page2)]);
    const names = await createSupabaseStorage(config, impl).list('projects');
    assert.equal(names.length, 1001);
    assert.equal(names.at(-1), 'last.json');
    assert.equal(JSON.parse(String(calls[1].body)).offset, 1000);
  });

  it('업로드 주소: Supabase가 준 상대 주소를 전체 주소로 바꾼다', async () => {
    const { impl } = fakeFetch([Response.json({ url: '/object/upload/sign/detail-page/files/a.png?token=abc' })]);
    const result = await createSupabaseStorage(config, impl).signedUploadUrl('files/a.png');
    assert.deepEqual(result, {
      token: 'abc',
      signedUrl: 'https://demo.supabase.co/storage/v1/object/upload/sign/detail-page/files/a.png?token=abc',
    });
  });
});
