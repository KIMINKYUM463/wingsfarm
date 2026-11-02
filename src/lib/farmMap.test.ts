import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeUnknownShape,
  fromApcRow,
  fromEcoRow,
  fromGapRow,
  isCurrent,
  matchRegion,
  matchesFilter,
  parseLooseJson,
  parsePage,
  publicPhone,
  rankSites,
  regionLabel,
  splitItems,
  summarizeRegions,
  topItems,
  xmlError,
  type FarmSite,
} from "./farmMap.ts";

const site = (patch: Partial<FarmSite>): FarmSite => ({
  id: "x",
  source: "gap",
  name: "",
  owner: "",
  producerType: "",
  items: [],
  region: "",
  address: "",
  phone: "",
  lat: null,
  lng: null,
  farms: 1,
  areaM2: null,
  planQty: null,
  cert: "GAP",
  validUntil: "",
  certBody: "",
  certBodyPhone: "",
  ...patch,
});

describe("주소 → 시군구", () => {
  it("품질원 법정동명 (시도 약칭이 한 번 더 붙은 형식)", () => {
    assert.equal(matchRegion("울산광역시 울산 울주군 상북면 궁근정리"), "26310");
    assert.equal(matchRegion("충청남도 충남 논산시 부적면 반송리"), "34060");
    assert.equal(matchRegion("경기도 경기 수원시 장안구 파장동"), "31011");
  });

  it("2026 전남광주통합특별시 — 전남 군과 광주 구를 모두 찾는다", () => {
    assert.equal(matchRegion("전남광주통합특별시 광주 해남군 옥천면 영춘리"), "36400");
    assert.equal(matchRegion("전남광주통합특별시 신안군 압해읍 압해로 980-11"), "36480");
    assert.equal(matchRegion("전남광주통합특별시 광주 북구 용봉동"), "24040");
  });

  it("같은 이름(고성군·중구)은 시도로 가린다", () => {
    assert.equal(matchRegion("강원특별자치도 고성군 토성면"), "32400");
    assert.equal(matchRegion("경상남도 고성군 고성읍"), "38340");
    assert.equal(matchRegion("부산광역시 중구 중앙동"), "21010");
  });

  it("세종·새로 생긴 구·시도가 바뀐 군", () => {
    assert.equal(matchRegion("세종특별자치시 세종 연서면 용암리"), "29010");
    assert.equal(matchRegion("경기도 화성시 동탄구 오산동"), "31240");
    assert.equal(matchRegion("인천광역시 미추홀구 주안동"), "23030");
    assert.equal(matchRegion("대구광역시 군위군 군위읍"), "37310");
  });

  it("시도 없이 생산지명만 와도, 못 찾으면 빈 값", () => {
    assert.equal(matchRegion("김천시"), "37030");
    assert.equal(matchRegion("중구"), "");
    assert.equal(matchRegion(""), "");
  });

  it("표시 이름", () => {
    assert.equal(regionLabel("37380"), "경북 성주군");
    assert.equal(regionLabel("31011"), "경기 수원시 장안구");
    assert.equal(regionLabel("29010"), "세종");
    assert.equal(regionLabel("nope"), "위치 미확인");
  });
});

describe("공공데이터 응답 읽기", () => {
  it("response.body.items.item 배열·단일 객체, totalCount", () => {
    const page = parsePage({ response: { header: { resultCode: "00", resultMsg: "NORMAL SERVICE." }, body: { items: { item: [{ a: 1 }, { a: 2 }] }, totalCount: "13447" } } });
    assert.equal(page.rows.length, 2);
    assert.equal(page.total, 13447);
    assert.equal(page.error, null);
    assert.equal(parsePage({ header: { resultCode: "00" }, body: { items: { item: { a: 1 } } } }).rows.length, 1);
    assert.equal(parsePage({ response: { body: { items: [{ a: 1 }] } } }).rows.length, 1);
  });

  it("오류 코드·데이터 없음", () => {
    assert.match(parsePage({ response: { header: { resultCode: "10", resultMsg: "INVALID_REQUEST_PARAMETER_ERROR" } } }).error ?? "", /코드 10/);
    assert.equal(parsePage({ response: { header: { resultCode: "03", resultMsg: "NODATA_ERROR" } } }).error, null);
  });

  it("인증키 오류는 XML로 와도 한국어 안내", () => {
    const xml = "<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>";
    assert.match(xmlError(xml) ?? "", /인증키가 등록되지 않았어요/);
    assert.equal(xmlError('{"response":{}}'), null);
  });

  it("CDATA로 감싼 XML 오류도 읽는다", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><RESULT><HEAD><resultCode><![CDATA[30]]></resultCode><resultMsg><![CDATA[SERVICE_KEY_IS_NOT_REGISTERED_ERROR]]></resultMsg></HEAD></RESULT>';
    assert.match(xmlError(xml) ?? "", /인증키가 등록되지 않았어요/);
  });

  it("코드 22라도 쪽 크기 초과면 호출 한도와 구분한다", () => {
    const xml = "<RESULT><HEAD><resultCode><![CDATA[22]]></resultCode><resultMsg><![CDATA[LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR(PAGE MAX COUNT : 100)]]></resultMsg></HEAD></RESULT>";
    assert.match(xmlError(xml) ?? "", /PAGE MAX COUNT : 100/);
  });

  it("값 안의 줄바꿈·이스케이프 안 된 큰따옴표 (품질원 실제 응답 형식)", () => {
    const text = [
      '{"DATA":{"ROW":[',
      "\t\t\t{",
      '\t\t\t\t"PRDCR_GRP_NM":""Peresvet"  LLC",',
      '\t\t\t\t"ITEM_NM":"이탈리안\n라이그라스",',
      '\t\t\t\t"NOTE":"이미 \\"이스케이프\\"된 값",',
      '\t\t\t\t"RPRSV_NM":"LLP"Mibeko""',
      "\t\t\t}",
      "]}}",
    ].join("\r\n");
    assert.throws(() => JSON.parse(text));
    const row = (parseLooseJson(text) as { DATA: { ROW: Record<string, string>[] } }).DATA.ROW[0];
    assert.equal(row.PRDCR_GRP_NM, '"Peresvet"  LLC');
    assert.equal(row.ITEM_NM, "이탈리안 라이그라스");
    assert.equal(row.NOTE, '이미 "이스케이프"된 값');
    assert.equal(row.RPRSV_NM, 'LLP"Mibeko"');
    assert.throws(() => parseLooseJson("<html>"));
  });
});

describe("행 → 산지", () => {
  it("GAP (품질원 미리보기 실제 행)", () => {
    const farm = fromGapRow({
      CERT_NO: "1029117",
      CERT_INST_NM: "플럼코트맘 주식회사",
      PRDCR_SE_VL: "3",
      PRDCR_GRP_NM: "옥천농업협동조합",
      RPRSV_NM: "윤치영",
      CERT_VLD_END_YMD: "20281025",
      ITEM_NM: "쌀",
      GRP_STDG_CD_NM: "전남광주통합특별시 광주 해남군 옥천면 영춘리",
      REG_FMHS_CNT: "54",
      CLTVT_AREA_VL: "4129189",
      PRDCTN_PLAN_QTY: "2687.64",
    });
    assert.ok(farm);
    assert.equal(farm.name, "옥천농업협동조합");
    assert.equal(farm.producerType, "단체");
    assert.deepEqual(farm.items, ["쌀"]);
    assert.equal(farm.farms, 54);
    assert.equal(farm.planQty, 2687.64);
    assert.equal(farm.validUntil, "2028-10-25");
    assert.equal(matchRegion(farm.address), "36400");
  });

  it("친환경 — 가려진 단체 전화는 버리고 인증기관 전화는 남김", () => {
    const farm = fromEcoRow({
      CERT_NO: "01300013",
      CERT_SE_CD: "3",
      CERT_VLD_END_YMD: "2027-03-14",
      CERT_INST_NM: "주식회사 녹색친환경",
      CERT_INST_TELNO: "055-356-6279",
      PRDCR_SE_NM: "단체",
      PRDCR_GRP_NM: "농업회사법인 플랜티팜 주식회사",
      RPRSV_NM: "강대현",
      GRP_STDG_CD_NM: "경기도 경기 평택시 진위면 하북리",
      GRP_TELNO: "*********",
      REG_FMHS_CNT: "1",
      CERT_ITEM_NM: "바질, 상추, 케일, 로메인",
    });
    assert.ok(farm);
    assert.equal(farm.cert, "무농약");
    assert.equal(farm.phone, "");
    assert.equal(farm.certBodyPhone, "055-356-6279");
    assert.deepEqual(farm.items, ["바질", "상추", "케일", "로메인"]);
  });

  it("APC — 위경도가 비면 null, 품목은 + 로 나눔", () => {
    const apc = fromApcRow({
      DIST_CENT_NM: "정읍단풍미인조합공동사업법인",
      LCTN_ROAD_NM_ADDR: "전북특별자치도 정읍시 북면 정읍북로 609",
      LAT: "35.61233218",
      LOT: "126.8919782",
      MAJ_ITEM_NM: "토마토+수박+방울토마토+배+등",
      FNDN_YR: "2014",
      TELNO: "063-538-1213",
      MNG_INST_NM: "전북특별자치도 정읍시청",
    });
    assert.ok(apc);
    assert.deepEqual(apc.items, ["토마토", "수박", "방울토마토", "배"]);
    assert.equal(apc.lat, 35.61233218);
    assert.equal(apc.phone, "063-538-1213");
    assert.equal(matchRegion(apc.address), "35040");
    assert.equal(fromApcRow({ DIST_CENT_NM: "곤명농협", LAT: "", LOT: "" })?.lat, null);
  });

  it("실제 응답 형식: 품질원 DATA.ROW, APC 카멜표기 칸", () => {
    const page = parsePage({
      HEAD: { resultCode: "00", resultMsg: "NORMAL_SERVICE", totalCount: 13456, numOfRows: 1, pageNo: 1 },
      DATA: { ROW: [{ CERT_NO: "1029169", PRDCR_SE_VL: "1", PRDCR_GRP_NM: "김동민", ITEM_NM: "대파", GRP_STDG_CD_NM: "경기도 경기 고양시 일산서구 법곳동 ", PRDCR_CNT: "1", CLTVTN_AREA_VL: "15300", CERT_VLD_END_YMD: "2028-10-31" }] },
    });
    assert.equal(page.total, 13456);
    assert.equal(page.rows.length, 1);
    const gap = fromGapRow(page.rows[0]);
    assert.equal(gap?.areaM2, 15300);
    assert.equal(matchRegion(gap?.address ?? ""), "31104");

    const apc = fromApcRow({ distCentNm: "청도농협(1센터)", lctnRoadNmAddr: "경상북도 청도군 청도읍 한내길 170", lat: "35.64554905", lot: "128.7467798", majItemNm: "복숭아, 감", telno: "054-373-3702", mngInstNm: "청도농협", fndnYr: "2014" });
    assert.equal(apc?.address, "경상북도 청도군 청도읍 한내길 170");
    assert.deepEqual(apc?.items, ["복숭아", "감"]);
    assert.equal(apc?.owner, "청도농협");
    assert.notEqual(matchRegion(apc?.address ?? ""), "");
  });

  it("칸 이름이 전혀 다르면 받은 칸을 알려 준다", () => {
    const rows = [{ foo: "1", bar: "2" }];
    assert.equal(fromGapRow(rows[0]), null);
    assert.match(describeUnknownShape(rows, 0) ?? "", /받은 칸: foo, bar/);
    assert.equal(describeUnknownShape(rows, 1), null);
  });

  it("품목·전화 정리", () => {
    assert.deepEqual(splitItems("토마토+ 파프리카+ 배+ 새송이"), ["토마토", "파프리카", "배", "새송이"]);
    assert.deepEqual(splitItems("사과(후지), 사과"), ["사과"]);
    assert.equal(publicPhone("061-***-1234"), "");
    assert.equal(publicPhone("061-246-0057"), "061-246-0057");
  });
});

describe("걸러내기·모으기", () => {
  const sites = [
    site({ id: "a", source: "gap", items: ["배"], region: "36400", farms: 10 }),
    site({ id: "b", source: "eco", items: ["배추"], region: "36400", farms: 1, phone: "061-000-0000" }),
    site({ id: "c", source: "apc", items: ["배", "사과"], region: "37380", farms: 0, name: "성주농협 APC" }),
    site({ id: "d", source: "gap", items: ["배"], region: "" }),
  ];
  const all = { sources: ["gap", "eco", "apc"] as FarmSite["source"][], item: "", query: "" };

  it("품목 칩은 정확히 같아야 (배 ≠ 배추)", () => {
    assert.deepEqual(sites.filter((s) => matchesFilter(s, { ...all, item: "배" })).map((s) => s.id), ["a", "c", "d"]);
    assert.deepEqual(sites.filter((s) => matchesFilter(s, { ...all, query: "성주 농협" })).map((s) => s.id), ["c"]);
    assert.deepEqual(sites.filter((s) => matchesFilter(s, { ...all, sources: ["eco"] })).map((s) => s.id), ["b"]);
  });

  it("시군구별 합계·위치 미확인·품목 순위·정렬", () => {
    const { regions, unlocated } = summarizeRegions(sites);
    assert.equal(unlocated, 1);
    assert.equal(regions[0].code, "36400");
    assert.equal(regions[0].sites, 2);
    assert.equal(regions[0].farms, 11);
    assert.deepEqual(regions[0].bySource, { gap: 1, eco: 1, apc: 0 });
    assert.deepEqual(topItems(sites, 2), [
      { name: "배", count: 3 },
      { name: "배추", count: 1 },
    ]);
    assert.equal(rankSites(sites)[0].id, "b");
  });

  it("지난 인증은 빼고, 날짜 모르면 남김", () => {
    assert.equal(isCurrent({ validUntil: "2026-01-01" }, "2026-10-30"), false);
    assert.equal(isCurrent({ validUntil: "2027-01-01" }, "2026-10-30"), true);
    assert.equal(isCurrent({ validUntil: "" }, "2026-10-30"), true);
  });
});
