/** 우리 API에 JSON을 보내고, 실패하면 서버가 준 한국어 안내(error)로 예외를 던진다 */
export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  return json as T;
}

export const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
