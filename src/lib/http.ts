/** JSON POST — 실패하면 서버가 보낸 error 문구로 throw */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  return json as T;
}

export const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
