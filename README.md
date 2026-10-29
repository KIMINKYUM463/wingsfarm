# 윙스팜AI

농수산물 위탁판매 셀러를 위한 AI 운영툴. 기획 배경·벤치마크·로드맵은 [`docs/기획서.md`](docs/기획서.md) 참고 (v1.3).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 마진 계산·출고 지연 문구 단위 테스트 (Node 24 내장 러너)
npm run typecheck  # 타입 검사
npm run lint
```

`.env.example`을 `.env.local`로 복사하고 키를 넣은 뒤 서버를 재시작하세요. 연결 여부는 **설정 → 연결 상태** 카드에서 확인할 수 있습니다.
- `OPENAI_API_KEY`: CS·키워드 AI·상품명·마케팅·썸네일·상세페이지·검색태그 (선택: `OPENAI_MODEL`, 이미지용 `OPENAI_IMAGE_MODEL`)
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`: 대시보드 트렌드, 키워드 분석의 추이·고객층 (데이터랩 쇼핑인사이트, 2027-06-30까지 개발자센터 키 사용 가능 → 이후 NAVER API HUB 키로 교체)
- `NAVER_AD_API_KEY` / `NAVER_AD_SECRET_KEY` / `NAVER_AD_CUSTOMER_ID`: 키워드 분석의 월간 검색수·연관 키워드 (네이버 검색광고 API)

### 배포할 때 (인터넷에 올리는 경우)
- `APP_PASSWORD`를 설정하면 사이트 전체에 비밀번호 창이 뜹니다(`src/proxy.ts`). 비워 두면 잠금 없음.
- AI 라우트는 IP별 호출 한도가 있습니다(기본 텍스트 10분 60회, 이미지 1시간 40회 · `AI_TEXT_LIMIT`, `AI_IMAGE_LIMIT`로 조정). 서버 메모리 기준이라 서버 1대 운영을 가정합니다.

## 기능

| 메뉴 | 설명 |
|---|---|
| 대시보드 | **오늘의 운영**(역마진 경보·오늘 할 일·작업 중인 상품), 네이버 검색 트렌드 급상승·인기 품목, 작년 기준 소싱 추천 |
| 보관함 | AI 결과(마케팅·썸네일·상세페이지·태그·상품명)를 IndexedDB에 자동 저장 · 검색·복사·이미지 일괄 다운로드 |
| 키워드 분석 | 월간 검색수·클릭률·광고 경쟁, 연관/황금 키워드, 상품명 조합, 성별·연령·기기, 검색 시즌, AI 분석 |
| 제철 캘린더 | 월별 제철표, 시즌 오픈 D-Day |
| 상품명 제조기 | 메인 키워드 + 연관/프리셋 수식어 조합, AI 상품명 5개 추천 → "작업 상품으로" 지정 |
| 검색 태그 | 스마트스토어 10개 / 쿠팡 20개 검색태그 AI 생성·복사 |
| 썸네일 제조기 | 상품 사진 → 메인/서브 구성·이미지 생성, 글씨·배너 편집 |
| 상세페이지 제작 | 4단계 입력(업체·상품 → AI 키워드 또는 벤치마킹 캡처 → 사진·테마·분량) → AI 섹션 초안 → 섹션 편집기(순서·복제·문구 다시 쓰기·AI 사진·되돌리기) → 860px 긴 JPG/섹션별 JPG 저장 |
| 윙스팜AI 마케팅 | 숏폼·쓰레드·카드뉴스·블로그·상세·리뷰·톡톡·라이브·검색광고 (사진은 확인 후 생성) |
| 가격·마진 | **전체 상품 역마진 점검표**(공급가 즉시 수정·이력·공급가 변동 시뮬레이션·권장가 적용), 단일 상품 실마진, 중량 옵션 권장가 |
| CS 도우미 | AI 답변(문의 캡처·글 → 유형·감정·증빙·할 일) + **출고 지연 선제 안내** 문구(톡톡·문자·공지) |
| 운영 체크리스트 | 매일·매주·매월 SOP (출고·CS·시세·제철·정산) |
| 설정 | 연결 상태, 수수료, 기본 비용, 공급처, 상품(채널별 판매가), JSON 백업/복원 |

"작업 중인 상품"은 상품명·태그·썸네일·마케팅·출고 지연 안내 화면이 함께 씁니다(사이드바에 표시).

## 저장 위치
- 설정·상품·체크리스트: 브라우저 localStorage (설정에서 JSON 백업)
- AI 결과 보관함: 브라우저 IndexedDB (최근 200건 유지, JSON 백업에는 포함되지 않음)
- 상세페이지 프로젝트: 같은 IndexedDB에 자동 저장 (최근 30개, 편집 0.7초 뒤 저장)

## 구조 메모
```
src/
  app/                 페이지 · api/ (AI 라우트는 lib/server/rateLimit으로 호출 제한)
  proxy.ts             APP_PASSWORD 비밀번호 잠금
  components/
    marketing/         studioUi(공통 입력·모달) · results(형식별 결과) · StudioShell
    margin/MarginBoard 전체 상품 마진표
    dashboard/TodayOps 오늘의 운영 카드
    cs/DelayNotice     출고 지연 안내
    detail/            상세페이지 제작 (Wizard 입력 · Editor · SectionView 렌더링 · Inspector)
  lib/
    detailPage.ts      상세페이지 섹션 모델(순수 함수, 테스트 있음)
    detailPageAi.ts    상세페이지 AI 지시문·스키마·응답 정리
    idb.ts             IndexedDB 공용 연결 (보관함·상세페이지)
    margin.ts          마진 계산 엔진(순수 함수, 테스트 있음)
    delayNotice.ts     지연 안내 문구(순수 함수, 테스트 있음)
    archive.ts         IndexedDB 보관함
    brand.ts           제품명 상수
```
