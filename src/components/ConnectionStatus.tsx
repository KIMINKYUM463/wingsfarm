"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@/app/api/health/route";
import { Badge, Card } from "@/components/ui";

const ITEMS: { key: keyof Pick<HealthResponse, "openai" | "naverDatalab" | "naverAd" | "kamis" | "farmMap" | "pexels" | "pixabay" | "coupangWing" | "supabase" | "passwordLock">; label: string; uses: string; env: string }[] = [
  { key: "openai", label: "OpenAI", uses: "상세페이지 판매 문구·CS·상품명·태그·썸네일·마케팅·리뷰 분석·문자 주문 정리", env: "OPENAI_API_KEY" },
  { key: "naverDatalab", label: "네이버 데이터랩", uses: "대시보드 트렌드·검색 추이·고객층", env: "NAVER_CLIENT_ID / SECRET" },
  { key: "naverAd", label: "네이버 검색광고", uses: "월간 검색수·연관 키워드·소싱 평가 검색 수요", env: "NAVER_AD_API_KEY 외 2개" },
  { key: "kamis", label: "KAMIS 농산물 시세", uses: "도매 시세·공급가 인상 경보 (무료 키)", env: "KAMIS_CERT_KEY / KAMIS_CERT_ID" },
  { key: "farmMap", label: "공공데이터포털", uses: "전국 산지 지도 — GAP·친환경 인증 생산자·APC (무료 키)", env: "DATA_GO_KR_KEY" },
  { key: "pexels", label: "Pexels 무료 영상", uses: "상세페이지 맨 위 움직이는 컷을 무료 영상으로 바꾸기 (무료 키)", env: "PEXELS_API_KEY" },
  { key: "pixabay", label: "Pixabay 무료 영상", uses: "무료 영상 검색 결과 늘리기 — Pexels와 함께 보여줌 (무료 키)", env: "PIXABAY_API_KEY" },
  { key: "coupangWing", label: "쿠팡 윙 Open API", uses: "광고 분석 — 광고 기간의 실제 쿠팡 매출로 전체 매출 대비 광고비 보기", env: "COUPANG_VENDOR_ID 외 2개" },
  { key: "supabase", label: "Supabase 저장소", uses: "배포 사이트에서 상세페이지 프로젝트·이미지 저장 (내 PC면 선택, Vercel이면 필수)", env: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" },
  { key: "passwordLock", label: "비밀번호 잠금", uses: "배포 시 남의 AI 사용 차단 (내 PC면 선택)", env: "APP_PASSWORD" },
];

/** 배포할 때만 필요한 항목 — 꺼져 있어도 경고하지 않는다 */
const OPTIONAL = new Set<string>(["supabase", "passwordLock"]);

export function ConnectionStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setFailed(true));
  }, []);

  return (
    <Card title="연결 상태" actions={health && <span className="text-xs text-stone-400">모델 {health.textModel} · 이미지 {health.imageModel}</span>} className="lg:col-span-2">
      {failed && <p className="text-sm text-rose-600">서버 상태를 확인하지 못했습니다.</p>}
      {!health && !failed && <p className="text-sm text-stone-400">확인 중…</p>}
      {health && (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ITEMS.map((item) => {
              const ok = health[item.key];
              return (
                <li key={item.key} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{item.label}</p>
                    <p className="text-xs text-stone-500">{item.uses}</p>
                    {!ok && <p className="mt-1 font-mono text-xs text-stone-500">{item.env}</p>}
                  </div>
                  <Badge tone={ok ? "good" : OPTIONAL.has(item.key) ? "default" : "warn"}>{ok ? "연결됨" : OPTIONAL.has(item.key) ? "꺼짐" : "미설정"}</Badge>
                </li>
              );
            })}
          </ul>
          {(!health.openai || !health.naverDatalab || !health.naverAd || !health.kamis || !health.farmMap) && (
            <p className="mt-3 text-xs leading-relaxed text-stone-500">
              프로젝트 폴더의 <code className="rounded bg-stone-100 px-1">.env.example</code>을 <code className="rounded bg-stone-100 px-1">.env.local</code>로 복사해 키를 넣고
              개발 서버를 다시 시작하세요.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
