/**
 * 에디터 "요소" 패널의 무료 아이콘·스티커 만들기 (목록을 고친 뒤 다시 실행, 결과 파일을 저장소에 넣는다)
 *
 * 원본 (모두 MIT — THIRD_PARTY_NOTICES.md에 저작권 표기)
 *   아이콘: Phosphor Icons      — @iconify-json/ph
 *   스티커: Fluent Emoji Flat   — @iconify-json/fluent-emoji-flat
 * 실행: node scripts/build-element-assets.mjs
 * 결과:
 *   src/features/editor/constants/shapes/icons.generated.json — 색을 바꿀 수 있는 path 아이콘 (100×100 좌표)
 *   src/server/lever/catalog/stickers.generated.json          — 컬러 스티커 SVG (그래픽 요소로 제공)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import svgpath from "svgpath";

const require = createRequire(import.meta.url);
const phosphor = require("@iconify-json/ph/icons.json");
const fluent = require("@iconify-json/fluent-emoji-flat/icons.json");

/** [원본 이름, 한국어 이름, 검색어] — 그룹 순서가 패널 순서 */
const ICON_GROUPS = [
  ["배송·포장", [
    ["truck", "배송 트럭", "택배 배송 차량 운송"],
    ["package", "택배 상자", "박스 포장 소포"],
    ["archive", "보관함", "박스 수납 창고 보관"],
    ["gift", "선물", "선물세트 명절 답례"],
    ["map-pin", "위치", "산지 주소 지도 핀"],
    ["clock", "시계", "시간 당일 출고"],
    ["calendar-check", "일정 확인", "달력 날짜 예약 출고일"],
    ["timer", "타이머", "마감 한정 시간"],
    ["airplane-tilt", "항공", "비행기 해외 빠른배송"],
    ["snowflake", "냉장·냉동", "눈 아이스팩 신선 저온"],
    ["thermometer-cold", "저온 보관", "온도 냉장 콜드체인"],
    ["storefront", "매장", "가게 상점 스토어"],
    ["house-line", "집 앞 배송", "집 가정 도착"],
    ["barcode", "바코드", "상품 코드"],
    ["receipt", "영수증", "주문 내역 결제"],
    ["hand-heart", "정성 포장", "손 마음 정성"],
  ]],
  ["자연·농업", [
    ["plant", "새싹", "식물 재배 성장 친환경"],
    ["leaf", "잎", "나뭇잎 자연 채소 친환경"],
    ["tree", "나무", "과수원 숲 자연"],
    ["flower", "꽃", "꽃잎 봄"],
    ["flower-tulip", "튤립", "꽃 봄"],
    ["sun", "햇살", "해 태양 일조량 여름"],
    ["cloud-sun", "날씨", "구름 해 기후"],
    ["drop", "물방울", "수분 촉촉 과즙 물"],
    ["carrot", "당근", "채소 야채"],
    ["orange-slice", "오렌지 단면", "귤 과일 감귤 단면"],
    ["grains", "곡물", "벼 쌀 보리 잡곡"],
    ["cow", "소", "한우 축산 목장"],
    ["bird", "새", "자연 생태"],
    ["butterfly", "나비", "자연 봄 친환경"],
    ["mountains", "산", "산지 고랭지 자연"],
    ["shovel", "삽", "농사 밭 재배"],
    ["potted-plant", "화분", "식물 재배"],
    ["barn", "헛간", "축사 농가 창고"],
    ["farm", "농장", "농가 밭 시골"],
    ["tractor", "트랙터", "농기계 농사 밭"],
    ["egg", "달걀", "계란 유정란"],
    ["fish", "생선", "수산 해산물 바다"],
    ["acorn", "도토리", "견과 가을"],
    ["clover", "클로버", "행운 풀"],
    ["rainbow", "무지개", "날씨 희망"],
    ["wind", "바람", "날씨 건조"],
    ["moon", "달", "밤 야간"],
  ]],
  ["음식·주방", [
    ["fork-knife", "식기", "포크 나이프 식사 레스토랑"],
    ["cooking-pot", "냄비", "요리 조리 끓이기"],
    ["bowl-food", "그릇", "밥 음식 한끼"],
    ["bowl-steam", "따뜻한 요리", "국 찌개 김 모락"],
    ["chef-hat", "셰프", "요리사 레시피"],
    ["knife", "칼", "손질 조리 썰기"],
    ["coffee", "커피", "음료 차 카페"],
    ["wine", "와인", "음료 술 선물"],
    ["pepper", "고추", "매운 양념 채소"],
    ["cheese", "치즈", "유제품"],
    ["bread", "빵", "베이커리 제과"],
    ["cake", "케이크", "디저트 축하"],
    ["cookie", "쿠키", "과자 디저트 간식"],
    ["ice-cream", "아이스크림", "디저트 여름 시원"],
    ["avocado", "아보카도", "과일 채소"],
    ["orange", "오렌지", "귤 과일 감귤"],
    ["egg-crack", "깨진 달걀", "계란 요리 베이킹"],
    ["fish-simple", "물고기", "생선 수산"],
    ["pizza", "피자", "음식 간식"],
    ["popcorn", "팝콘", "간식"],
  ]],
  ["쇼핑·혜택", [
    ["shopping-cart", "장바구니", "카트 구매 쇼핑"],
    ["shopping-bag", "쇼핑백", "구매 쇼핑"],
    ["tag", "가격표", "택 가격 할인"],
    ["percent", "퍼센트", "할인 세일 특가"],
    ["seal-percent", "할인 뱃지", "할인 세일 쿠폰"],
    ["coins", "동전", "돈 적립 포인트"],
    ["currency-krw", "원화", "가격 원 돈"],
    ["credit-card", "카드 결제", "신용카드 결제 무이자"],
    ["wallet", "지갑", "결제 돈 절약"],
    ["ticket", "쿠폰", "티켓 이벤트 혜택"],
    ["crown", "왕관", "베스트 1등 프리미엄"],
    ["sparkle", "반짝임", "신상 강조 포인트"],
    ["fire", "불꽃", "인기 핫딜 HOT"],
    ["lightning", "번개", "번개배송 빠른 특가"],
    ["hand-coins", "적립", "포인트 리워드 캐시백"],
    ["piggy-bank", "저금통", "절약 알뜰"],
    ["megaphone", "확성기", "공지 이벤트 홍보"],
    ["bell", "알림", "벨 공지 소식"],
  ]],
  ["품질·안심", [
    ["seal-check", "인증 체크", "보증 확인 품질"],
    ["shield-check", "안심 보장", "방패 안전 보증"],
    ["certificate", "인증서", "증명 자격 검사"],
    ["medal", "메달", "수상 1등 우수"],
    ["trophy", "트로피", "수상 우승 베스트"],
    ["thumbs-up", "추천", "좋아요 엄지 최고"],
    ["check-circle", "체크", "확인 완료 포인트"],
    ["check", "체크 표시", "확인 완료"],
    ["heart", "하트", "좋아요 사랑 찜"],
    ["star", "별", "별점 평점 리뷰"],
    ["handshake", "약속", "악수 신뢰 계약"],
    ["lock", "잠금", "보안 안전"],
    ["eye", "눈", "확인 보기 선별"],
    ["magnifying-glass", "돋보기", "검사 확인 선별 찾기"],
    ["flask", "실험", "성분 연구 분석"],
    ["microscope", "현미경", "검사 연구 분석"],
    ["recycle", "재활용", "친환경 순환"],
    ["first-aid-kit", "구급상자", "건강 안전"],
  ]],
  ["소통·리뷰", [
    ["chat-circle", "말풍선", "대화 채팅 문의"],
    ["chat-circle-dots", "말풍선 점", "대화 채팅 입력중"],
    ["chats", "대화", "말풍선 상담 문의"],
    ["chat-teardrop-text", "후기 말풍선", "리뷰 후기 대화"],
    ["quotes", "따옴표", "인용 후기 리뷰"],
    ["phone", "전화", "고객센터 상담 연락"],
    ["envelope", "편지", "메일 문의 연락"],
    ["users", "사람들", "고객 가족 회원"],
    ["user", "사람", "고객 회원 농부"],
    ["smiley", "웃는 얼굴", "만족 행복 이모티콘"],
    ["smiley-wink", "윙크", "만족 이모티콘"],
    ["star-half", "반 별", "별점 평점"],
    ["camera", "카메라", "사진 포토 리뷰"],
    ["share-network", "공유", "공유하기 SNS"],
    ["bell-ringing", "알림 울림", "알림 공지"],
    ["headset", "상담", "고객센터 헤드셋"],
  ]],
  ["정보·안내", [
    ["info", "정보", "안내 참고 i"],
    ["warning", "주의", "경고 유의"],
    ["warning-circle", "느낌표", "주의 경고 강조"],
    ["question", "물음표", "질문 FAQ 문의"],
    ["list-checks", "체크리스트", "목록 확인"],
    ["list-numbers", "번호 목록", "순서 단계"],
    ["number-circle-one", "1번", "숫자 순서 단계 하나"],
    ["number-circle-two", "2번", "숫자 순서 단계 둘"],
    ["number-circle-three", "3번", "숫자 순서 단계 셋"],
    ["clipboard-text", "클립보드", "정보 고시 상세"],
    ["note-pencil", "메모", "작성 노트 연필"],
    ["ruler", "자", "크기 사이즈 길이"],
    ["scales", "저울", "무게 중량 kg"],
    ["hourglass", "모래시계", "시간 숙성 기다림"],
    ["lightbulb", "전구", "팁 아이디어 꿀팁"],
    ["target", "과녁", "목표 포인트 핵심"],
    ["push-pin", "핀", "고정 공지 압정"],
    ["bookmark-simple", "북마크", "저장 표시"],
  ]],
  ["화살표", [
    ["arrow-right", "오른쪽 화살표", "화살표 방향"],
    ["arrow-down", "아래 화살표", "화살표 방향"],
    ["arrow-up", "위 화살표", "화살표 방향"],
    ["arrow-left", "왼쪽 화살표", "화살표 방향"],
    ["arrow-circle-right", "원형 화살표", "화살표 다음"],
    ["arrow-fat-right", "굵은 화살표", "화살표 강조"],
    ["arrow-fat-down", "굵은 아래 화살표", "화살표 강조"],
    ["arrow-bend-down-right", "꺾인 화살표", "화살표 방향"],
    ["arrow-u-up-left", "되돌림 화살표", "화살표 반품 교환"],
    ["caret-right", "꺾쇠", "화살표 쉐브론"],
    ["caret-down", "아래 꺾쇠", "화살표 쉐브론 더보기"],
    ["caret-double-down", "이중 꺾쇠", "화살표 스크롤 아래"],
    ["arrows-clockwise", "순환", "새로고침 교환 반복"],
    ["hand-pointing", "가리키는 손", "클릭 손가락 강조"],
    ["cursor-click", "클릭", "마우스 커서 누르기"],
  ]],
];

/** 꽉 찬(fill) 버전 — 이미 위에서 이름·검색어를 준 아이콘만 */
const FILLED = [
  "heart", "star", "check-circle", "seal-check", "truck", "gift", "tag", "leaf", "sun", "drop",
  "chat-circle", "phone", "map-pin", "crown", "fire", "lightning", "thumbs-up", "sparkle",
  "shield-check", "bell", "clock", "shopping-cart", "flower", "snowflake",
];

const STICKER_GROUPS = [
  ["과일", [
    ["red-apple", "사과", "빨간 사과 과일"],
    ["green-apple", "풋사과", "초록 사과 과일"],
    ["pear", "배", "과일 신고배"],
    ["tangerine", "귤", "감귤 한라봉 과일"],
    ["lemon", "레몬", "과일 상큼"],
    ["banana", "바나나", "과일"],
    ["watermelon", "수박", "과일 여름"],
    ["grapes", "포도", "샤인머스캣 과일"],
    ["strawberry", "딸기", "과일 겨울 봄"],
    ["melon", "멜론", "참외 과일"],
    ["cherries", "체리", "과일"],
    ["peach", "복숭아", "과일 여름"],
    ["mango", "망고", "과일 열대"],
    ["pineapple", "파인애플", "과일 열대"],
    ["kiwi-fruit", "키위", "과일 참다래"],
    ["blueberries", "블루베리", "과일 베리"],
    ["coconut", "코코넛", "과일 열대"],
  ]],
  ["채소", [
    ["tomato", "토마토", "채소 방울토마토"],
    ["carrot", "당근", "채소"],
    ["ear-of-corn", "옥수수", "채소 곡물 찰옥수수"],
    ["hot-pepper", "고추", "채소 매운"],
    ["bell-pepper", "파프리카", "피망 채소"],
    ["cucumber", "오이", "채소"],
    ["leafy-green", "잎채소", "상추 배추 쌈 채소"],
    ["broccoli", "브로콜리", "채소"],
    ["garlic", "마늘", "채소 양념"],
    ["onion", "양파", "채소"],
    ["potato", "감자", "채소"],
    ["roasted-sweet-potato", "고구마", "군고구마 채소"],
    ["mushroom", "버섯", "표고 채소"],
    ["eggplant", "가지", "채소"],
    ["avocado", "아보카도", "채소 과일"],
    ["chestnut", "밤", "견과 가을"],
    ["peanuts", "땅콩", "견과"],
  ]],
  ["음식", [
    ["cooked-rice", "밥", "쌀 공기밥 햅쌀"],
    ["rice-ball", "주먹밥", "밥 쌀"],
    ["bento-box", "도시락", "밥 반찬"],
    ["steaming-bowl", "국수", "면 따뜻한"],
    ["pot-of-food", "찌개", "냄비 요리 국"],
    ["honey-pot", "꿀", "벌꿀 꿀단지"],
    ["egg", "달걀", "계란"],
    ["cooking", "계란 프라이", "요리 프라이팬"],
    ["bread", "빵", "식빵 베이커리"],
    ["cheese-wedge", "치즈", "유제품"],
    ["shrimp", "새우", "수산 해산물"],
    ["fish", "생선", "수산 해산물"],
    ["crab", "게", "꽃게 대게 수산"],
    ["oyster", "굴", "조개 수산"],
    ["cut-of-meat", "고기", "한우 정육 축산"],
    ["poultry-leg", "닭다리", "닭고기 축산"],
    ["glass-of-milk", "우유", "유제품 음료"],
    ["hot-beverage", "따뜻한 차", "커피 음료"],
    ["teacup-without-handle", "찻잔", "녹차 차 음료"],
    ["beverage-box", "주스 팩", "음료 주스"],
    ["shortcake", "조각 케이크", "디저트 딸기"],
    ["cookie", "쿠키", "과자 디저트"],
    ["soft-ice-cream", "소프트 아이스크림", "디저트 여름"],
  ]],
  ["자연·계절", [
    ["seedling", "새싹", "식물 재배 성장"],
    ["herb", "허브", "잎 채소 식물"],
    ["four-leaf-clover", "네잎클로버", "행운"],
    ["maple-leaf", "단풍잎", "가을"],
    ["fallen-leaf", "낙엽", "가을"],
    ["sunflower", "해바라기", "꽃 여름"],
    ["blossom", "꽃", "봄"],
    ["cherry-blossom", "벚꽃", "봄 꽃"],
    ["tulip", "튤립", "꽃 봄"],
    ["deciduous-tree", "나무", "과수원 자연"],
    ["evergreen-tree", "소나무", "나무 겨울"],
    ["sheaf-of-rice", "벼", "쌀 곡물 수확 추석"],
    ["sun", "해", "햇살 여름"],
    ["rainbow", "무지개", "날씨"],
    ["snowflake", "눈송이", "겨울 냉동"],
    ["droplet", "물방울", "수분 과즙"],
    ["honeybee", "꿀벌", "벌 꿀 자연"],
    ["lady-beetle", "무당벌레", "벌레 자연 친환경"],
    ["butterfly", "나비", "자연 봄"],
    ["cow-face", "소", "한우 축산"],
    ["pig-face", "돼지", "한돈 축산"],
    ["chicken", "닭", "축산 달걀"],
    ["hatching-chick", "병아리", "달걀 봄"],
    ["tractor", "트랙터", "농기계 농사 농장"],
    ["house-with-garden", "농가", "집 시골 농장"],
  ]],
  ["표현·축하", [
    ["wrapped-gift", "선물 상자", "선물 명절"],
    ["party-popper", "축하", "파티 이벤트"],
    ["confetti-ball", "꽃가루", "축하 이벤트"],
    ["balloon", "풍선", "축하 이벤트"],
    ["ribbon", "리본", "선물 포장"],
    ["red-heart", "빨간 하트", "사랑 좋아요"],
    ["sparkling-heart", "반짝 하트", "사랑 좋아요"],
    ["hundred-points", "100점", "만점 최고"],
    ["thumbs-up", "엄지 척", "최고 추천 좋아요"],
    ["clapping-hands", "박수", "칭찬 축하"],
    ["smiling-face-with-heart-eyes", "하트 눈", "만족 맛있는 반한"],
    ["face-savoring-food", "냠냠", "맛있는 먹방"],
    ["star-struck", "감탄", "놀라운 대박"],
    ["check-mark-button", "체크", "확인 완료"],
    ["fire", "불꽃", "인기 핫딜"],
    ["sparkles", "반짝반짝", "신상 강조"],
    ["glowing-star", "빛나는 별", "베스트 추천"],
    ["crown", "왕관", "1등 프리미엄"],
    ["trophy", "트로피", "수상 1등"],
    ["1st-place-medal", "금메달", "1등 수상"],
    ["delivery-truck", "배송 트럭", "택배 배송"],
    ["package", "택배 상자", "배송 박스"],
    ["shopping-cart", "장바구니", "구매 쇼핑"],
    ["money-bag", "돈 자루", "혜택 적립"],
    ["alarm-clock", "알람 시계", "마감 시간 한정"],
    ["megaphone", "확성기", "공지 이벤트"],
    ["light-bulb", "전구", "꿀팁 아이디어"],
    ["round-pushpin", "위치 핀", "산지 위치"],
    ["speech-balloon", "말풍선", "대화 후기"],
  ]],
];

const ICON_BOX = 100;

/** Iconify body에서 path 하나의 d만 꺼낸다 (여러 요소면 오류) */
function singlePathData(name, body) {
  const tags = body.match(/<[a-z]+/g) ?? [];
  const d = /^<path fill="currentColor" d="([^"]+)"\/>$/.exec(body)?.[1];
  if (tags.length !== 1 || !d) throw new Error(`단일 path 아이콘이 아님: ${name}`);
  return d;
}

/** 256 상자 → 100 상자로 줄이고 소수 1자리로 반올림 */
const toIconBox = (d, size) =>
  svgpath(d).scale(ICON_BOX / size).round(1).toString();

const pick = (set, name) => {
  const icon = set.icons[name];
  return { ...icon, width: icon.width ?? set.width, height: icon.height ?? set.height };
};

/** 원본에 없는 이름을 한 번에 모두 알려 준다 */
function assertExists(set, names, label) {
  const missing = names.filter((name) => !set.icons[name]);
  if (missing.length) throw new Error(`${label} 원본에 없는 이름: ${missing.join(", ")}`);
}

function assertUnique(ids) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`중복 id: ${id}`);
    seen.add(id);
  }
}

assertExists(
  phosphor,
  [...ICON_GROUPS.flatMap(([, items]) => items.map(([name]) => name)), ...FILLED.map((name) => `${name}-fill`)],
  "아이콘",
);
assertExists(fluent, STICKER_GROUPS.flatMap(([, items]) => items.map(([name]) => name)), "스티커");

const iconInfo = new Map(ICON_GROUPS.flatMap(([, items]) => items.map((item) => [item[0], item])));

const icons = [
  ...ICON_GROUPS.flatMap(([group, items]) =>
    items.map(([name, label, keywords]) => ({ name, group, label, keywords })),
  ),
  ...FILLED.map((name) => {
    const info = iconInfo.get(name);
    if (!info) throw new Error(`FILLED에 이름·검색어가 없는 아이콘: ${name}`);
    return { name: `${name}-fill`, group: "채움", label: info[1], keywords: `${info[2]} 채움 꽉찬` };
  }),
].map(({ name, group, label, keywords }) => {
  const icon = pick(phosphor, name);
  return {
    id: `icon-${name}`,
    name: label,
    group,
    keywords,
    data: toIconBox(singlePathData(name, icon.body), icon.width),
  };
});

const stickers = STICKER_GROUPS.flatMap(([group, items]) =>
  items.map(([name, label, keywords]) => {
    const icon = pick(fluent, name);
    return {
      slug: `sticker-${name}`,
      name: label,
      group: `스티커 · ${group}`,
      keywords,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 ${icon.width} ${icon.height}">${icon.body}</svg>`,
    };
  }),
);

assertUnique(icons.map((i) => i.id));
assertUnique(stickers.map((s) => s.slug));

const write = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);
write("src/features/editor/constants/shapes/icons.generated.json", icons);
write("src/server/lever/catalog/stickers.generated.json", stickers);

const kb = (path) => `${Math.round(readFileSync(path).length / 1024)}KB`;
console.log(
  `아이콘 ${icons.length}개 (${kb("src/features/editor/constants/shapes/icons.generated.json")}),`,
  `스티커 ${stickers.length}개 (${kb("src/server/lever/catalog/stickers.generated.json")})`,
);
