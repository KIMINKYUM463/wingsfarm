/**
 * 수강생 로드맵 — 농수산물 위탁판매를 처음 시작하는 수강생이 첫 판매·첫 정산까지 가는 순서.
 * 각 단계는 윙스팜AI 도구나 공식 사이트로 바로 이어진다. 완료 상태는 opsChecks의 `roadmap:` 키에 저장.
 */

export interface RoadmapStep {
  id: string;
  title: string;
  detail: string;
  /** 앱 안 도구 */
  href?: string;
  /** 공식 사이트 */
  link?: { label: string; url: string };
}

export interface RoadmapStage {
  id: string;
  title: string;
  goal: string;
  steps: RoadmapStep[];
}

export const ROADMAP: RoadmapStage[] = [
  {
    id: "biz",
    title: "1. 사업자 준비",
    goal: "합법적으로 팔 수 있는 상태 만들기",
    steps: [
      {
        id: "biz-register",
        title: "사업자등록 (홈택스)",
        detail: "업태 '도소매', 종목 '전자상거래 소매업'. 미가공 농수산물만 팔면 면세, 가공식품도 팔면 과세 겸업으로 등록하세요. 간이·일반 선택은 예상 매출로.",
        link: { label: "홈택스", url: "https://www.hometax.go.kr" },
      },
      {
        id: "biz-mailorder",
        title: "통신판매업 신고 (정부24)",
        detail: "스마트스토어 등에서 '구매안전서비스 이용확인증'을 받아 첨부합니다. 직전 연도 거래 50회 미만 등 면제 기준이 있지만 처음부터 신고해 두면 마켓 심사가 쉬워요.",
        link: { label: "정부24", url: "https://www.gov.kr" },
      },
      {
        id: "biz-food",
        title: "가공식품을 팔면 영업신고 확인",
        detail: "미가공 농수산물 위탁판매는 식품 영업신고가 필요 없지만, 직접 소분·포장하거나 가공식품을 자기 이름으로 팔면 유통전문판매업 등 신고가 필요할 수 있어요. 시·군·구 위생과에 확인하세요.",
      },
      { id: "biz-account", title: "사업용 통장·카드 분리", detail: "정산금·공급처 결제를 사업용 계좌로 모아야 장부와 세금 신고가 쉬워요." },
    ],
  },
  {
    id: "store",
    title: "2. 판매 채널 개설",
    goal: "주문을 받을 가게 열기",
    steps: [
      { id: "store-naver", title: "스마트스토어 개설", detail: "판매자 정보·정산 계좌·반품지 등록. 반품지는 공급처와 협의해 정하세요.", link: { label: "스마트스토어센터", url: "https://sell.smartstore.naver.com" } },
      { id: "store-coupang", title: "쿠팡 윙 개설 (선택)", detail: "농산물은 신선 카테고리 출고 기준이 엄격해요. 첫 상품은 한 채널에서 익힌 뒤 늘리세요.", link: { label: "쿠팡 윙", url: "https://wing.coupang.com" } },
      { id: "store-fee", title: "채널 수수료를 내 값으로 맞추기", detail: "카테고리·등급마다 다른 실제 수수료를 설정에 넣어야 마진 계산이 맞아요.", href: "/settings" },
    ],
  },
  {
    id: "supplier",
    title: "3. 공급처 확보",
    goal: "믿을 수 있는 산지 2곳 이상",
    steps: [
      { id: "sup-two", title: "공급처 2곳 이상 확보", detail: "한 곳만 쓰면 품절·품질 문제 때 대응할 수 없어요. 같은 품목의 대체 공급처를 미리 정하세요." },
      {
        id: "sup-terms",
        title: "공급 조건 문서로 받기",
        detail: "공급가(택배비 포함 여부), 발주 마감시각, 출고 요일, 신선품 금요일 출고 여부, 파손·상함 보상 기준, 송장 회신 방법을 카톡이 아닌 문서로.",
      },
      { id: "sup-register", title: "공급처·상품을 윙스팜AI에 등록", detail: "공급가·택배비·채널별 판매가를 넣어 두면 역마진 점검과 CS 답변에 자동으로 쓰여요.", href: "/settings" },
    ],
  },
  {
    id: "product",
    title: "4. 첫 상품 고르기",
    goal: "마진이 남고 지금 팔리는 품목",
    steps: [
      { id: "prod-trend", title: "트렌드·제철 보기", detail: "대시보드의 '지금 소싱하면 좋은 품목'과 제철 캘린더에서 후보를 3개 이상 고르세요.", href: "/" },
      { id: "prod-farm", title: "산지 찾기", detail: "전국 산지 지도에서 후보 품목을 고르면 인증 농가·산지유통센터가 많은 지역과 공개 연락처가 나옵니다.", href: "/farm-map" },
      { id: "prod-price", title: "도매 시세 확인", detail: "공급가가 시세보다 비싸지 않은지, 요즘 시세가 오르는 중인지 봅니다.", href: "/prices" },
      { id: "prod-margin", title: "옵션·판매가 설계 (역마진 금지)", detail: "2·3·5kg 옵션별 권장가와 옵션명을 만들고, 광고비·CS 적립까지 넣어도 남는지 확인하세요.", href: "/margin?tab=options" },
    ],
  },
  {
    id: "listing",
    title: "5. 상품 등록",
    goal: "검색에 걸리고, 법에 걸리지 않는 상세페이지",
    steps: [
      { id: "list-keyword", title: "키워드·상품명·태그", detail: "검색량 있는 키워드로 상품명을 만들고 태그를 채웁니다.", href: "/titles" },
      { id: "list-visual", title: "썸네일·상세페이지", detail: "실제 사진을 기준으로, 크기·당도·중량을 수치로 보여 주세요.", href: "/detail-page" },
      { id: "list-check", title: "상품정보고시·원산지 확인", detail: "효능·과장 표현(면역력·다이어트 등), 상품명과 원산지의 산지 불일치, 고시 누락이 없는지 등록 전에 직접 확인하세요." },
    ],
  },
  {
    id: "operate",
    title: "6. 첫 주문 처리",
    goal: "실수 없이 출고하고 첫 정산 받기",
    steps: [
      { id: "op-order", title: "공급처에 발주 보내기", detail: "마켓 주문을 공급처 양식에 맞춰 발주 마감시각 전에 보내세요." },
      { id: "op-invoice", title: "송장 회신 받아 마켓에 등록", detail: "받는 분·주문번호가 맞는지 확인하고 당일 안에 송장을 등록하세요." },
      { id: "op-cs", title: "첫 CS 응대", detail: "캡처를 붙여넣으면 답변 초안이 나와요.", href: "/cs" },
    ],
  },
  {
    id: "grow",
    title: "7. 매출 키우기",
    goal: "재구매와 시즌 매출",
    steps: [
      { id: "grow-review", title: "리뷰 분석으로 품질 이슈 잡기", detail: "리뷰를 붙여넣어 불만 원인을 찾고 공급처에 전달하세요.", href: "/reviews" },
      { id: "grow-content", title: "주 2회 콘텐츠 발행", detail: "콘텐츠 캘린더대로 숏폼·카드뉴스를 올리세요.", href: "/season?tab=content" },
      { id: "grow-holiday", title: "명절 선물 시즌 준비", detail: "연휴 45일 전부터 선물세트 구성·상세페이지·주문 마감 공지를 준비하세요.", href: "/season?tab=content" },
      { id: "grow-supplier", title: "공급처 품질 점검", detail: "파손·상함 클레임이 잦은 공급처는 포장·선별 기준을 다시 맞추거나 교체하세요." },
      { id: "grow-routine", title: "운영 체크리스트 루틴화", detail: "매일 5분·매주 30분·매월 2시간.", href: "/ops" },
    ],
  },
];

export const ROADMAP_STEPS = ROADMAP.flatMap((stage) => stage.steps);
export const roadmapKey = (stepId: string) => `roadmap:${stepId}`;

export function roadmapProgress(checks: Record<string, boolean>) {
  const done = ROADMAP_STEPS.filter((s) => checks[roadmapKey(s.id)]).length;
  const next = ROADMAP_STEPS.find((s) => !checks[roadmapKey(s.id)]) ?? null;
  return { done, total: ROADMAP_STEPS.length, next };
}
