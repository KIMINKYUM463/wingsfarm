# 윙스팜AI

농수산물 위탁판매 셀러를 위한 AI 운영툴. 기획 배경·벤치마크·로드맵은 [`docs/기획서.md`](docs/기획서.md) 참고 (v1.4).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 마진 계산·출고 지연 문구 단위 테스트 (Node 24 내장 러너)
npm run typecheck  # 타입 검사
npm run lint
```

`.env.example`을 `.env.local`로 복사하고 키를 넣은 뒤 서버를 재시작하세요. 연결 여부는 **설정 → 연결 상태** 카드에서 확인할 수 있습니다.
- `OPENAI_API_KEY`: CS·키워드 AI·상품명·마케팅·썸네일·검색태그 (선택: `OPENAI_MODEL`, 이미지용 `OPENAI_IMAGE_MODEL`)
- 상세페이지 제작은 **Gemini API 키**를 씁니다. 화면의 프로필 메뉴 → API 키 설정에서 등록(권장)하거나 `GEMINI_API_KEY`에 넣으세요. (선택: `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, 저장 폴더 `LEVER_DATA_DIR`)
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`: 대시보드 트렌드, 키워드 분석의 추이·고객층 (데이터랩 쇼핑인사이트, 2027-06-30까지 개발자센터 키 사용 가능 → 이후 NAVER API HUB 키로 교체)
- `NAVER_AD_API_KEY` / `NAVER_AD_SECRET_KEY` / `NAVER_AD_CUSTOMER_ID`: 키워드 분석의 월간 검색수·연관 키워드 (네이버 검색광고 API)

### 배포할 때 (인터넷에 올리는 경우)
- `APP_PASSWORD`를 설정하면 사이트 전체가 잠기고 비밀번호만 입력하는 로그인 화면(`/login`)이 뜹니다(`src/proxy.ts`). 비워 두면 잠금 없음.
- AI 라우트는 IP별 호출 한도가 있습니다(기본 텍스트 10분 60회, 이미지 1시간 40회 · `AI_TEXT_LIMIT`, `AI_IMAGE_LIMIT`로 조정). 서버 메모리 기준이라 서버 1대 운영을 가정합니다.
- **Vercel**은 서버에 파일을 저장할 수 없으므로 상세페이지에 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`가 필수입니다(비공개 버킷 `detail-page` 자동 생성). 내 PC 데이터는 `.env.local`에 같은 키를 넣고 `npm run migrate:supabase`로 옮깁니다. 상세페이지 Gemini 키는 Vercel 환경변수 `GEMINI_API_KEY`로 넣습니다. 맨 위 움직이는 컷은 PC에 ffmpeg가 없으면 npm 패키지 `ffmpeg-static`의 ffmpeg를 씁니다(Vercel 포함). 무료 영상은 `PEXELS_API_KEY` / `PIXABAY_API_KEY`도 Vercel에 넣어야 합니다(최대 3개를 골라 Gemini로 컷 편집, 키가 없으면 기본 편집).

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
| 윙스팜AI 상세페이지 | [레버페이지](https://github.com/KIMINKYUM463/leverpage) 화면·편집기(Konva) 그대로: AI로 초안 만들기(카테고리 매칭 → 키워드/이미지 방식 → 템플릿 문구 주입) → 요소 단위 편집기(텍스트·이미지·도형·AI 문구/이미지·되돌리기) → 이미지 다운로드. **Figma 템플릿 불러오기**(템플릿 관리 화면). 후커블식 추가 기능: 입력 폼 → 기획 초안(섹션 카드·사실 확인) → 생성, 색상 탭, AI 채팅 수정, 버전 기록, 판매처별 다운로드(JPG·PNG·WEBP·HTML), 편집 투어, 즐겨찾기·휴지통·사본·재사용 (`docs/기획서.md` 11장). 디자인 스타일 4종(모던·내추럴·프리미엄·발랄) 고유 템플릿 57개 — 기획 초안의 **디자인** 버튼·에디터 템플릿 탭 (12장) |
| 윙스팜AI 마케팅 | 숏폼·쓰레드·카드뉴스·블로그·상세·리뷰·톡톡·라이브·검색광고 (사진은 확인 후 생성) |
| 가격·마진 | **전체 상품 역마진 점검표**(공급가 즉시 수정·이력·공급가 변동 시뮬레이션·권장가 적용), 단일 상품 실마진, 중량 옵션 권장가 |
| CS 도우미 | AI 답변(문의 캡처·글 → 유형·감정·증빙·할 일) + **출고 지연 선제 안내** 문구(톡톡·문자·공지) |
| 운영 체크리스트 | 매일·매주·매월 SOP (출고·CS·시세·제철·정산) |
| 설정 | 연결 상태, 수수료, 기본 비용, 공급처, 상품(채널별 판매가), JSON 백업/복원 |

"작업 중인 상품"은 상품명·태그·썸네일·마케팅·출고 지연 안내 화면이 함께 씁니다(사이드바에 표시).

## 저장 위치
- 설정·상품·체크리스트: 브라우저 localStorage (설정에서 JSON 백업)
- AI 결과 보관함: 브라우저 IndexedDB (최근 200건 유지, JSON 백업에는 포함되지 않음)
- 상세페이지 프로젝트·템플릿·업로드 사진·Gemini 키·Figma 토큰: 서버 폴더 `.data/detail-page` (git 제외, `LEVER_DATA_DIR`로 변경) — Supabase 키가 있으면 Supabase Storage 버킷

## 상세페이지 Figma 템플릿 불러오기
1. Figma → Settings → Security → Personal access tokens 에서 토큰 발급 (File content: Read)
2. 상세페이지 화면 프로필 메뉴 → **템플릿 관리 (Figma)** → 토큰과 파일 URL 입력 → **Figma에서 동기화**
3. 파일 구조 규칙
   - 페이지 이름 = 대분류(part1, 예: `도입`, `설득`)
   - 섹션 이름 = 구성(part2, 예: `2-3 핵심 포인트` — 앞 숫자가 정렬 순서)
   - 섹션 안의 프레임 = 템플릿 1개 (섹션 없이 프레임 이름을 `핵심 포인트 / A안`처럼 써도 됨)
   - 이름에 `_image`가 들어간 사각형 = 상품 사진(AI 이미지) 자리, `_`로 시작하는 페이지·섹션·프레임은 건너뜀
4. 다시 동기화하면 Figma 템플릿은 새 내용으로 교체되고, 이미 만든 프로젝트는 그대로 유지됩니다.

## 구조 메모
```
src/
  app/(main)/          윙스팜AI 화면 (루트 레이아웃 1)
  app/(lever)/detail-page/  레버페이지 화면 원본 (루트 레이아웃 2: 프로젝트 목록·생성·편집기·API 키·템플릿 관리)
  app/api/lever/[...path]   레버페이지 백엔드(비공개 Supabase 대체) → server/lever/router.ts
  features/ shared/ utils/ validation/   레버페이지 프론트 코드 원본
  server/lever/        파일 저장소(.data) · 프로젝트/프레임/에셋 · Gemini 생성 · Figma 동기화
  server/figma-to-konva/  Figma 노드 → Konva 요소 변환기
  app/api/             윙스팜AI AI 라우트 (lib/server/rateLimit으로 호출 제한)
  proxy.ts             APP_PASSWORD 비밀번호 잠금
  components/
    marketing/         studioUi(공통 입력·모달) · results(형식별 결과) · StudioShell
    margin/MarginBoard 전체 상품 마진표
    dashboard/TodayOps 오늘의 운영 카드
    cs/DelayNotice     출고 지연 안내
  lib/
    idb.ts             IndexedDB 공용 연결 (보관함)
    margin.ts          마진 계산 엔진(순수 함수, 테스트 있음)
    delayNotice.ts     지연 안내 문구(순수 함수, 테스트 있음)
    archive.ts         IndexedDB 보관함
    brand.ts           제품명 상수
```
