/* 숏폼 스튜디오 화면 (프레임워크 없이 바닐라 JS) */
const S = {
  boot: null,
  filter: { tpl: "all", cat: "all", hook: "all", src: "all", q: "", limit: 60 },
  analysis: {},
  make: freshMake(),
  jobs: [],
  poll: null,
  previewTimer: null,
  lintTimer: null,
};
const CATS = ["과일", "채소", "수산", "축산", "가공"];
const INFO_TPLS = ["고르는법", "보관경고", "손질법", "물량리빌"];
const ROLE_KO = { HOOK: "훅", TIP: "팁", STEP: "단계", WRONG: "X 잘못", RIGHT: "O 정답", COMPARE: "비교", REVEAL: "공개", SHOW: "보여주기", CTA: "마무리" };
const SHOT_KO = { hook: "대표 컷", detail: "클로즈업", crave: "먹는 장면", hero: "진열·상자", hold: "손에 들기", pack: "포장", store: "보관", prep: "손질", origin: "산지 풍경", photo: "상품 사진" };
const VOICE_KO = { narration: "내레이션", talking_head: "사람이 직접 말함", text_only: "자막 + 음악", asmr: "현장 소리(ASMR)" };
const LAYOUT_KO = { letterbox: "위아래 검은 제목형", full: "꽉 찬 화면" };

function freshMake() {
  return {
    tpl: null, ref: null,
    product: { name: "", category: "", origin: "", price: "", unit: "", memo: "", photoData: null },
    info: null,            // 서버에 저장된 상품 정보
    fields: {}, drafted: false, via: null,
    opts: { music: "밝은", voice: "여성", ai_label: true, motion: false },
    mode: "ai", job: null, scene: 0, sceneLocked: false,
    chat: [], lint: [],
  };
}

/* ---------- 도우미 ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hl = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
function views(n) {
  n = n || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + "만";
  return n.toLocaleString();
}
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), err ? 5000 : 2600);
}
/* 윙스팜 Next 앱에 이식: /api/shortform 으로 호출 (별도 스튜디오 서버 없음) */
const API = "/api/shortform";
function rewriteMedia(x) {
  if (typeof x === "string") return x.startsWith("/media/") ? API + x : x;
  if (Array.isArray(x)) return x.map(rewriteMedia);
  if (x && typeof x === "object") {
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = rewriteMedia(v);
    return o;
  }
  return x;
}
async function api(path, body) {
  // 원본 호출은 /api/bootstrap 형태. 베이스가 이미 /api/shortform 이라 /api 를 한 번 벗긴다
  // → /api/shortform/bootstrap (이중 /api/shortform/api/bootstrap 방지)
  const p = path.startsWith("/api/") ? path.slice(4) : path;
  const r = await fetch(API + p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `요청 실패 (${r.status})`);
  return rewriteMedia(d);
}
function thumb(id) { return `https://i.ytimg.com/vi/${id}/oar2.jpg`; }
function thumbFallback(img, id) { img.onerror = null; img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function tplOf(id) { return S.boot.templates[id]; }
function refOf(id) { return S.boot.references.find((r) => r.id === id); }
function hookOf(k) { return S.boot.hooks[k] || { label: k || "기타", formula: "" }; }
function isShoot(t) { return t && t.kind === "촬영"; }
function isClone() { return S.make.tpl === "clone"; }
async function getAnalysis(id) {
  if (S.analysis[id]) return S.analysis[id];
  try { S.analysis[id] = await api("/api/analysis/" + encodeURIComponent(id)); } catch (e) { return null; }
  return S.analysis[id];
}

/* 템플릿 {key|기본값} 채우기 (make_template.py 의 fill 과 같은 규칙) */
function fill(s, ctx) {
  if (typeof s !== "string") return s;
  const re = /\{(\w+)(?:\|([^{}]*))?\}/g;
  for (let i = 0; i < 6; i++) {
    const n = s.replace(re, (_, k, d) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== "" ? String(ctx[k]) : d || ""));
    if (n === s) break;
    s = n;
  }
  return s;
}

/* ---------- 라우팅 ---------- */
function parseHash() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  return { path, q: Object.fromEntries(new URLSearchParams(qs || "")) };
}
function route() {
  const { path, q } = parseHash();
  clearInterval(S.previewTimer);
  const modal = $("#modal");
  if (!modal.hidden) { modal.hidden = true; modal.innerHTML = ""; }
  const nav = path.startsWith("/make") ? "make" : path.startsWith("/templates") ? "templates" : path.startsWith("/jobs") ? "jobs" : "refs";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  if (nav === "make") {
    const M = S.make;
    if (q.tpl && q.tpl !== M.tpl) { M.tpl = q.tpl; M.fields = {}; M.drafted = false; M.scene = 0; M.chat = []; M.job = null; }
    if (q.ref !== undefined && q.ref !== (M.ref || "")) {
      M.ref = q.ref || null;
      M.job = null; M.chat = [];
      if (isClone()) { M.fields = {}; M.drafted = false; }
    }
    renderMake();
  } else if (nav === "templates") renderTemplates();
  else if (nav === "jobs") renderJobs();
  else renderRefs();
  window.scrollTo(0, 0);
}

/* ---------- 레퍼런스 ---------- */
function filteredRefs() {
  const f = S.filter, q = f.q.trim();
  return S.boot.references
    .filter((r) => (f.tpl === "all" || r.template === f.tpl) && (f.cat === "all" || r.category === f.cat) &&
      (f.hook === "all" || r.hook === f.hook) && (f.src === "all" || (f.src === "analyzed" ? r.analyzed : r.source === f.src)) &&
      (!q || (r.title + " " + r.item).includes(q)))
    .sort((a, b) => b.views - a.views);
}

function renderRefs() {
  const { references: refs, templates } = S.boot;
  const f = S.filter;
  const list = filteredRefs();
  const count = (key, val) => refs.filter((r) => r[key] === val).length;
  const infoMed = median(refs.filter((r) => INFO_TPLS.includes(r.template)).map((r) => r.views));
  const saleMed = median(refs.filter((r) => r.template === "판매형").map((r) => r.views));
  const nAnalyzed = refs.filter((r) => r.analyzed).length;
  const tplIds = Object.keys(templates).filter((k) => count("template", k));
  const hookIds = Object.keys(S.boot.hooks).filter((k) => count("hook", k));
  const chip = (key, val, label, n) => `<button class="chip ${f[key] === val ? "on" : ""}" data-f="${key}" data-v="${esc(val)}">${esc(label)}${n !== undefined ? `<span class="n">${n}</span>` : ""}</button>`;

  $("#app").innerHTML = `
    <div class="hero">
      <div>
        <h1>잘 된 숏폼을 분석해서, 내 상품으로 다시 만든다</h1>
        <p class="lead">조회수 높은 농수산물 쇼츠 ${refs.length}개를 모았습니다. 영상을 누르면 Claude가 장면 구성·자막 방식·훅을 분석해 보여 주고, <b>“이 구조 그대로 내 상품으로”</b>를 누르면 같은 흐름으로 내 영상을 만듭니다.</p>
      </div>
      <form class="url-box panel" id="url-form">
        <b>찾은 영상이 있나요?</b>
        <span class="muted">유튜브 쇼츠 주소를 붙여 넣으면 바로 분석해 드려요.</span>
        <div style="display:flex;gap:8px"><input type="text" id="url-in" placeholder="https://youtube.com/shorts/..."><button class="btn primary" id="url-go">분석하기</button></div>
      </form>
    </div>
    <div class="insight">
      <div class="panel"><b>${refs.length}개</b><span>레퍼런스 (직접 고른 ${count("source", "curated")} · 자동 수집 ${count("source", "auto")} · 내가 추가 ${count("source", "user")})</span></div>
      <div class="panel"><b>${views(infoMed)}회 vs ${views(saleMed)}회</b><span>정보형 vs 판매만 하는 영상의 조회수 중간값 (자동 수집은 1.5만 회 이상만 모아서, 실제 차이는 더 커요)</span></div>
    </div>
    <div class="filters">
      <div class="filter-row"><b>찾기</b><input type="text" id="ref-q" value="${esc(f.q)}" placeholder="품목이나 제목 (예: 귤, 손질)" style="max-width:280px">
        <div class="chips">${chip("src", "all", "전체")}${chip("src", "analyzed", "분석 완료", nAnalyzed)}${chip("src", "curated", "직접 고른")}${chip("src", "auto", "자동 수집")}${count("source", "user") ? chip("src", "user", "내가 추가") : ""}</div></div>
      <div class="filter-row"><b>형식</b><div class="chips">${chip("tpl", "all", "전체", refs.length)}${tplIds.map((k) => chip("tpl", k, shortName(k), count("template", k))).join("")}</div></div>
      <div class="filter-row"><b>품목</b><div class="chips">${chip("cat", "all", "전체")}${CATS.filter((c) => count("category", c)).map((c) => chip("cat", c, c, count("category", c))).join("")}</div></div>
      <div class="filter-row"><b>훅</b><div class="chips">${chip("hook", "all", "전체")}${hookIds.map((k) => chip("hook", k, hookOf(k).label, count("hook", k))).join("")}</div></div>
    </div>
    <div class="muted" style="margin-bottom:10px">${list.length}개 · 조회수 순</div>
    <div class="ref-grid">${list.slice(0, f.limit).map(refCard).join("") || `<div class="empty">조건에 맞는 레퍼런스가 없어요.</div>`}</div>
    ${list.length > f.limit ? `<div style="text-align:center;margin-top:20px"><button class="btn" id="more">더 보기 (${list.length - f.limit}개 남음)</button></div>` : ""}`;
  document.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { S.filter[b.dataset.f] = b.dataset.v; S.filter.limit = 60; renderRefs(); }));
  document.querySelectorAll(".ref").forEach((el) => el.addEventListener("click", () => openRef(el.dataset.id)));
  const more = $("#more"); if (more) more.onclick = () => { S.filter.limit += 60; renderRefs(); };
  const qi = $("#ref-q");
  qi.oninput = () => { clearTimeout(qi._t); qi._t = setTimeout(() => { S.filter.q = qi.value; S.filter.limit = 60; renderRefs(); const n = $("#ref-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
  $("#url-form").onsubmit = async (e) => {
    e.preventDefault();
    const url = $("#url-in").value.trim(); if (!url) return;
    const b = $("#url-go"); b.disabled = true; b.innerHTML = `<span class="spin"></span> 분석 중…`;
    try {
      const d = await api("/api/analyze", { url });
      S.analysis[d.analysis.meta.id] = d.analysis;
      S.boot.references = (await api("/api/bootstrap")).references;
      openRef(d.analysis.meta.id);
    } catch (err) { toast(err.message, true); }
    b.disabled = false; b.textContent = "분석하기";
  };
}

function shortName(tplId) {
  return { 고르는법: "고르는 법", 보관경고: "보관 경고", 손질법: "손질법", 물량리빌: "개수 공개", 비교: "VS 비교", 짧은루프: "짧은 상품컷", 카드: "사진 카드", 판매형: "판매형", 깎기ASMR: "깎기 ASMR", 현장리포트: "현장 리포트", clone: "레퍼런스 복제" }[tplId] || tplId;
}

function refCard(r) {
  const t = tplOf(r.template);
  return `<div class="ref" data-id="${esc(r.id)}">
    <div class="thumb">
      <img src="${thumb(r.id)}" onerror="thumbFallback(this,'${esc(r.id)}')" alt="" loading="lazy">
      <span class="views ${r.views >= 1e6 ? "big" : ""}">▶ ${views(r.views)}</span>
      ${r.analyzed ? `<span class="tag ana shoot-flag">분석 완료</span>` : isShoot(t) ? `<span class="tag shoot shoot-flag">직접 촬영</span>` : ""}
    </div>
    <div class="body">
      <div class="title">${esc(r.title)}</div>
      <div class="meta"><span class="tag tname">${esc(shortName(r.template))}</span><span class="tag hook">${esc(hookOf(r.hook).label)}</span>${r.item ? `<span class="tag">${esc(r.item)}</span>` : ""}</div>
    </div>
  </div>`;
}

function structure(t) {
  if (t.engine === "short") return ["훅", "산지", "특징 1~3", "먹는 장면", "가격 카드", "주문"];
  if (t.output === "cards") return ["표지", "항목 카드", "마무리 카드"];
  return (t.segments || []).map((s) => {
    if (s.each) return { items: "항목 반복", steps: "단계 반복", wrong: "X 잘못된 방법", right: "O 맞는 방법" }[s.each] || s.each;
    return { HOOK: "훅", CTA: "마무리", REVEAL: "숫자 공개", TIP: s.label ? fill(s.label, { a_name: "A", b_name: "B" }) : "장면" }[s.kind] || s.kind;
  });
}
const structureHtml = (t) => `<div class="structure">${structure(t).map((s) => `<span>${esc(s)}</span>`).join("<i>→</i>")}</div>`;

/* 프레임 묶음(가로로 붙인 5장)에서 i번째 칸을 잘라 보여 준다 */
function frameTile(id, i, n = 5, cls = "ftile") {
  return `<div class="${cls}" style="background-image:url('${API}/media/frames/${esc(id)}.jpg');background-size:${n * 100}% 100%;background-position:${n > 1 ? (i / (n - 1)) * 100 : 0}% 0"></div>`;
}

function anatomyHtml(a, id) {
  const sc = a.scenes || [];
  const labels = a.frames && a.frames.length ? a.frames : ["시작", "25%", "50%", "75%", "표지"];
  const nFrames = labels.length;
  const cap = a.caption || {};
  const chips = [
    LAYOUT_KO[a.layout] || a.layout, VOICE_KO[a.voice] || a.voice,
    cap.style === "keyword_highlight" ? `핵심어 강조 자막(${{ yellow: "노랑", green: "초록", red: "빨강" }[cap.color] || cap.color})` : cap.style === "none" ? "자막 없음" : "기본 자막",
    a.presenter === "face" ? "얼굴 출연" : a.presenter === "hands" ? "손만 등장" : "사람 없음",
    `${a.setting || ""}`, `템포 ${a.pacing || ""}`, `음악 ${a.music || ""}`,
  ].filter((x) => x && x.trim());
  return `<div class="anatomy">
    <h3>Claude의 장면 분석 <span class="muted">· 장면 사진 ${nFrames}장과 제목으로 추정</span></h3>
    <p style="margin:0 0 8px">${esc(a.summary || "")}</p>
    <div class="chips" style="margin-bottom:10px">${chips.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
    <div class="frames" style="grid-template-columns:repeat(${nFrames},1fr)">${labels.map((l, i) => `<figure>${frameTile(id, i, nFrames)}<figcaption>${esc(l)}</figcaption></figure>`).join("")}</div>
    <ol class="timeline">${sc.map((s) => `<li><span class="role r-${esc(s.role)}">${esc(s.label || ROLE_KO[s.role] || s.role)}</span>
      <div><b>${esc(s.purpose || s.text || "—")}</b>${s.text && s.purpose ? ` <span class="muted">“${esc(s.text)}”</span>` : ""}
      <div class="muted">${esc(SHOT_KO[s.shot] || s.shot)} · ${esc(s.seconds)}초 · ${esc(s.note || "")}</div></div></li>`).join("")}</ol>
    ${(a.why || []).length ? `<h3 style="margin-top:12px">잘 된 이유</h3><ul class="why">${a.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    ${a.copy_style ? `<div class="muted">말투: ${esc(a.copy_style)}</div>` : ""}
  </div>`;
}

async function openRef(id) {
  const r = refOf(id) || { id, title: id, views: 0, template: "고르는법", hook: "", item: "", category: "" };
  const t = tplOf(r.template) || tplOf("고르는법"), h = hookOf(r.hook);
  const m = $("#modal");
  m.innerHTML = `<div class="modal-box">
    <button class="modal-close" aria-label="닫기">×</button>
    <div class="modal-video"><iframe src="https://www.youtube.com/embed/${esc(r.id)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    <div class="modal-info">
      <div><span class="tag tname">${esc(shortName(r.template))}</span> ${r.item ? `<span class="tag">${esc(r.item)} · ${esc(r.category)}</span>` : ""}</div>
      <h2 style="margin:0">${esc(r.title)}</h2>
      <div class="muted">조회수 ${(r.views || 0).toLocaleString()}회 · <a href="https://www.youtube.com/shorts/${esc(r.id)}" target="_blank" rel="noopener">유튜브에서 보기 ↗</a></div>
      <div class="formula"><b>훅 공식 · ${esc(h.label)}</b><p>${esc(h.formula)}</p>${r.why ? `<div class="muted" style="margin-top:4px">${esc(r.why)}</div>` : ""}</div>
      <div id="anatomy"><div class="anatomy"><span class="spin"></span> 분석 결과 불러오는 중…</div></div>
      <div class="cta-row">
        <a class="btn primary big" href="#/make?tpl=clone&ref=${encodeURIComponent(r.id)}">이 구조 그대로 내 상품으로 →</a>
        ${isShoot(t) ? "" : `<a class="btn" href="#/make?tpl=${encodeURIComponent(r.template)}&ref=${encodeURIComponent(r.id)}">‘${esc(shortName(r.template))}’ 템플릿으로</a>`}
      </div>
      ${isShoot(t) ? shootGuide(t) : ""}
    </div>
  </div>`;
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ""; };
  $(".modal-close", m).onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
  m.querySelectorAll("a[href^='#']").forEach((a) => a.addEventListener("click", close));

  const box = $("#anatomy", m);
  const a = await getAnalysis(id);
  if (!box.isConnected) return;
  if (a) { box.innerHTML = anatomyHtml(a, id); return; }
  box.innerHTML = `<div class="anatomy"><b>아직 분석하지 않은 영상이에요.</b>
    <p class="muted" style="margin:4px 0 10px">Claude가 프레임과 제목을 보고 장면 구성·자막 방식·말투를 분석해요 (10~20초).</p>
    <button class="btn yellow" id="do-ana">지금 분석하기</button></div>`;
  $("#do-ana", m).onclick = async (e) => {
    e.target.disabled = true; e.target.innerHTML = `<span class="spin"></span> 분석 중…`;
    try {
      const d = await api("/api/analyze", { id });
      S.analysis[id] = d.analysis;
      const rr = refOf(id); if (rr) rr.analyzed = true;
      if (box.isConnected) box.innerHTML = anatomyHtml(d.analysis, id);
    } catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = "다시 시도"; }
  };
}

function shootGuide(t) {
  const guides = {
    깎기ASMR: ["휴대폰을 세로로 고정하고 칼과 손이 화면 가운데 오게 둡니다.", "음악 없이 칼질 소리를 살립니다. 마이크를 칼 가까이.", "통째로 든 모습 2초 → 깎는 장면 10~30초(끊지 않기) → 완성 접시 3초."],
    현장리포트: ["현장 전경 + 질문 자막 (예: 새벽 4시 가락시장 참외 경매)", "경매·선별·포장 손 장면 3~5초씩", "생산자·경매사 한마디. 얼굴이 나오면 신뢰가 크게 올라요."],
  }[t.id] || [];
  return `<div class="formula" style="background:var(--blue-soft)"><b style="color:#2d4f9a">직접 촬영을 추천하는 형식</b>
    <p style="font-weight:500">${guides.map((g, i) => `${i + 1}. ${esc(g)}`).join("<br>")}</p>
    <div class="muted">“이 구조 그대로”를 누르면 AI 장면으로 비슷하게 만들 수 있지만, 실제 촬영본이 훨씬 강해요.</div></div>`;
}

/* ---------- 템플릿 ---------- */
function renderTemplates() {
  const ts = Object.values(S.boot.templates);
  const nRef = (id) => S.boot.references.filter((r) => r.template === id).length;
  $("#app").innerHTML = `
    <h1>템플릿</h1>
    <p class="lead">레퍼런스를 형식별로 묶어 만든 영상 틀입니다. 특정 영상의 구조를 그대로 따르고 싶으면 레퍼런스에서 “이 구조 그대로”를 쓰세요.</p>
    <div class="tpl-grid">
      ${ts.map((t) => `<div class="panel tpl">
        ${t.sample && t.sample.endsWith(".mp4") ? `<video class="sample" src="${t.sample}" muted loop playsinline preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause()"></video>`
          : t.sample ? `<img class="sample" src="${t.sample}" alt="">` : `<div class="sample">${isShoot(t) ? "직접 촬영" : "샘플 없음"}</div>`}
        <div>
          <h3>${esc(t.name)}</h3>
          ${isShoot(t) ? `<span class="tag shoot">직접 촬영</span>` : `<span class="tag tname">자동</span>`}
          <p style="margin-top:8px">${esc(t.when || "")}</p>
          ${structureHtml(t)}
          <div class="ev" style="margin-top:8px">근거: ${esc(t.evidence || "")}</div>
          <div class="actions">
            ${nRef(t.id) ? `<button class="btn small" data-reftpl="${esc(t.id)}">레퍼런스 ${nRef(t.id)}개</button>` : ""}
            ${isShoot(t) ? "" : `<a class="btn small primary" href="#/make?tpl=${encodeURIComponent(t.id)}&ref=">만들기</a>`}
          </div>
        </div>
      </div>`).join("")}
    </div>`;
  document.querySelectorAll("[data-reftpl]").forEach((b) => b.addEventListener("click", () => {
    S.filter = { ...S.filter, tpl: b.dataset.reftpl, cat: "all", hook: "all", src: "all", q: "", limit: 60 }; location.hash = "#/";
  }));
}

/* ---------- 만들기 ---------- */
function autoTemplates() { return Object.values(S.boot.templates).filter((t) => !isShoot(t)); }

/* 복제 모드의 가상 템플릿 (화면 칸 정의) */
function cloneTpl() {
  const a = S.make.ref && S.analysis[S.make.ref];
  return {
    id: "clone", name: "레퍼런스 복제", layout: a ? a.layout : "full", title: ["{title1}", "{title2}"], info: "{info}",
    fields: [
      { key: "title1", label: "제목 1줄", type: "text", max: 13, hint: "레퍼런스에 고정 제목이 없으면 비워 두세요" },
      { key: "title2", label: "제목 2줄", type: "text", max: 13 },
      { key: "info", label: "아래 안내 바", type: "text", max: 22 },
    ],
  };
}
function curTpl() { return isClone() ? cloneTpl() : tplOf(S.make.tpl); }

async function renderMake() {
  const M = S.make;
  if (isClone()) {
    if (!M.ref) { M.tpl = "고르는법"; }
    else if (!S.analysis[M.ref]) {
      $("#app").innerHTML = `<div class="loading"><span class="spin"></span> 레퍼런스 분석 결과를 준비하는 중… (처음이면 10~20초)</div>`;
      try { const d = await api("/api/analyze", { id: M.ref }); S.analysis[M.ref] = d.analysis; const rr = refOf(M.ref); if (rr) rr.analyzed = true; }
      catch (e) { toast(e.message, true); M.tpl = "고르는법"; }
    }
  }
  if (!isClone() && (!M.tpl || !tplOf(M.tpl) || isShoot(tplOf(M.tpl)))) M.tpl = "고르는법";
  const t = curTpl();
  if (!aiAvailable()) M.mode = "photo";
  const a = isClone() ? S.analysis[M.ref] : null;
  if (a && !M.drafted && !M.fields.lines) {
    M.fields = { title1: "", title2: "", info: "", voice_mode: a.voice === "text_only" || a.voice === "asmr" ? "text_only" : "narration",
      lines: a.scenes.map((s) => ({ say: "", label: s.label, role: s.role, source: s.shot === "origin" ? "stock:origin" : s.shot === "photo" ? "photo:1" : "ai:" + s.shot })) };
    M.opts.music = a.music && a.music !== "없음" ? a.music : (M.fields.voice_mode === "text_only" ? "밝은" : M.opts.music);
  }
  const refs = isClone() ? S.boot.references.filter((r) => r.id === M.ref) : S.boot.references.filter((r) => r.template === M.tpl).slice(0, 40);
  if (!isClone() && M.ref && !refs.some((r) => r.id === M.ref)) { const rr = refOf(M.ref); if (rr) refs.unshift(rr); else M.ref = null; }
  const ref = M.ref && refOf(M.ref);
  const products = S.boot.products;

  $("#app").innerHTML = `
    <h1>${isClone() ? "레퍼런스 구조 그대로 만들기" : "만들기"}</h1>
    <p class="lead">${isClone() ? "레퍼런스의 장면 순서·자막 방식·말투를 그대로 따라, 내 상품 사진으로 장면을 새로 만들어요." : "템플릿 고르기 → 상품명과 사진 한 장 → AI 문구 초안 확인 → 영상 만들기."} 문구는 초안이니 사실과 다른 부분은 꼭 고쳐 주세요.</p>
    <div class="make">
      <div class="steps">
        <section class="panel step">
          <div class="step-head"><span class="step-num">1</span><h2>${isClone() ? "따라 할 레퍼런스" : "템플릿과 레퍼런스"}</h2></div>
          ${isClone() ? "" : `<div class="pick-row">
            <select id="tpl-sel">${autoTemplates().map((x) => `<option value="${esc(x.id)}" ${x.id === M.tpl ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
            <select id="ref-sel">
              <option value="">레퍼런스 없이 (템플릿 기본 말투)</option>
              ${refs.map((r) => `<option value="${esc(r.id)}" ${r.id === M.ref ? "selected" : ""}>${esc(r.title.slice(0, 34))} · ${views(r.views)}</option>`).join("")}
            </select>
          </div>`}
          ${ref ? `<div class="ref-pick">
              <div class="mini" style="background-image:url('${thumb(ref.id)}'),url('https://i.ytimg.com/vi/${esc(ref.id)}/hqdefault.jpg')"></div>
              <div><b>${esc(ref.title)}</b><span class="muted">${views(ref.views)}회 · ${esc(hookOf(ref.hook).label)} · ${esc(hookOf(ref.hook).formula)}</span></div>
              <button class="btn small" id="ref-view">영상·분석 보기</button>
            </div>` : `<div class="muted">레퍼런스를 고르면 그 영상의 훅 공식으로 문구 초안을 씁니다. 특정 영상의 구조를 그대로 따르려면 <a href="#/">레퍼런스</a>에서 “이 구조 그대로”를 누르세요.</div>`}
          ${isClone() && a ? `<div class="clone-sum">${anatomyMini(a)}</div>
            <div style="margin-top:8px"><a class="btn small ghost" href="#/make?tpl=${encodeURIComponent(ref ? ref.template : "고르는법")}&ref=${encodeURIComponent(M.ref)}">대신 일반 템플릿으로 만들기</a></div>`
          : `<div style="margin-top:12px">${structureHtml(t)}</div>
             ${ref ? `<div style="margin-top:8px"><a class="btn small ghost" href="#/make?tpl=clone&ref=${encodeURIComponent(ref.id)}">이 레퍼런스 구조 그대로 만들기로 바꾸기</a></div>` : ""}`}
        </section>

        <section class="panel step">
          <div class="step-head"><span class="step-num">2</span><h2>상품</h2>
            <div class="right">${products.length ? `<select id="prod-sel" style="width:auto">
              <option value="">새 상품</option>
              ${products.map((p) => `<option value="${esc(p.folder)}" ${M.info && M.info.folder === p.folder ? "selected" : ""}>${esc(p.name)} (${esc(p.category || "")}${p.cached.length ? ` · AI 장면 ${p.cached.length}개` : ""})</option>`).join("")}
            </select>` : ""}</div>
          </div>
          <div class="grid2">
            <div class="field full">
              <label>상품 사진 한 장</label>
              <label class="drop" id="drop">
                <div class="ph" id="ph" style="${photoUrl() ? `background-image:url('${photoUrl()}')` : ""}">${photoUrl() ? "" : "＋"}</div>
                <div><b>사진을 끌어다 놓거나 눌러서 고르세요</b><div class="muted">상품이 잘 보이는 사진 한 장. AI 장면이 이 사진의 생김새를 따라 만들어지고, 다 만든 뒤 실물과 같은지 점검해요.</div></div>
                <input type="file" id="photo" accept="image/*" hidden>
              </label>
            </div>
            <div class="field"><label>상품명 *</label><input type="text" id="p-name" value="${esc(M.product.name)}" placeholder="예: 제주 노지감귤"></div>
            <div class="field"><label>분류</label><select id="p-cat"><option value="">사진 보고 자동</option>${CATS.map((c) => `<option ${M.product.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
            <div class="field"><label>산지 <span class="cnt">선택</span></label><input type="text" id="p-origin" value="${esc(M.product.origin)}" placeholder="예: 제주 서귀포"></div>
            <div class="field"><label>구성 <span class="cnt">선택</span></label><input type="text" id="p-unit" value="${esc(M.product.unit)}" placeholder="예: 5kg 한 박스 (40~50과)"></div>
            <div class="field"><label>판매가 (원) <span class="cnt">선택</span></label><input type="number" id="p-price" value="${esc(M.product.price)}" placeholder="19900"></div>
            <div class="field full"><label>판매자 메모 <span class="cnt">AI가 참고하는 사실 정보</span></label><textarea id="p-memo" placeholder="예: 껍질이 얇고 당도가 높은 편. 주문 다음 날 수확해서 보냄. 한 박스 약 45개.">${esc(M.product.memo)}</textarea></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px">
            <button class="btn primary" id="save-prod">${M.info ? "상품 정보 다시 저장" : "상품 저장 · 사진 분석"}</button>
            <span class="muted" id="save-msg"></span>
          </div>
          ${M.info ? `<div class="ident">✓ <b>${esc(M.info.name)}</b> · ${esc(M.info.category)}${M.info.en_name ? ` · AI용 설명: <i>${esc(M.info.en_name)}</i>` : ""}${M.info.look ? `<br>${esc(M.info.look)}` : ""}${M.info.cached.length ? `<br>이미 만든 AI 장면 ${M.info.cached.length}개는 다시 쓰고 비용이 들지 않아요.` : ""}</div>
          <div class="plan-cta"><div><b>한 편씩 말고, 일주일치를 한 번에</b><div class="muted">Claude가 분석해 둔 레퍼런스 중 이 상품에 맞는 5편을 골라 요일별로 기획하고 모두 만들어요.</div></div>
            <button class="btn yellow" id="plan-btn">✨ 일주일치 기획하기</button></div>
          ${M.info.real_photo === false ? `<div class="lint" style="margin-top:8px"><b>⚠ 올린 이미지가 실제 사진이 아니라 그림(일러스트)으로 보여요.</b><div>AI 장면이 실물과 달라질 수 있어요. 휴대폰으로 찍은 실제 상품 사진을 올리면 훨씬 정확해요.</div></div>` : ""}` : ""}
        </section>

        <section class="panel step ${M.info ? "" : "locked"}" id="step3">
          <div class="step-head"><span class="step-num">3</span><h2>${isClone() ? "장면별 문장" : "문구"}</h2>
            <div class="right"><button class="btn yellow" id="draft">${M.drafted ? "AI 초안 다시 쓰기" : isClone() ? "Claude가 내 상품으로 다시 쓰기" : "AI 문구 초안 만들기"}</button></div>
          </div>
          ${!M.info ? `<div class="locked-hint">2단계에서 <b>상품 저장 · 사진 분석</b>을 누르면 열려요.</div>` : ""}
          ${M.drafted ? `<div class="draft-note">${M.via === "규칙" ? "AI 연결이 안 돼서 규칙 문구만 채웠어요. 직접 고치거나 키(FAL/OpenAI)를 확인한 뒤 다시 눌러 주세요." : M.via === "이전 작업" ? "이전에 만든 영상의 문구예요." : `AI가 쓴 초안이에요${M.via ? ` (${esc(M.via)})` : ""}. 숫자·산지·보관법처럼 사실 확인이 필요한 말은 꼭 확인해 주세요. <b>*별표*</b>로 감싼 단어는 강조색으로 나와요.`}</div>` : `<div class="muted" style="margin-bottom:10px">초안 없이 직접 써도 돼요. <b>*별표*</b>로 감싼 단어는 영상에서 강조색으로 나와요. AI 장면 영상은 FAL_KEY가 필요하고, 문구 초안은 OpenAI 키로도 됩니다.</div>`}
          <div class="grid2" id="fields"></div>
          <div id="lint"></div>
        </section>

        <section class="panel step ${M.info ? "" : "locked"}" id="step4">
          <div class="step-head"><span class="step-num">4</span><h2>영상 만들기</h2></div>
          <div class="modes">
            <div class="mode ${M.mode === "ai" ? "on" : ""} ${aiAvailable() && S.boot.engine !== "web" ? "" : "disabled"}" data-mode="ai"><b>AI 장면 + 사진</b><span>${S.boot.engine === "web" ? "웹 엔진에서는 아직 준비 중이에요. 사진만 모드를 써 주세요." : "장면마다 AI가 사진 속 상품으로 5초 영상을 만들어요. 처음 만드는 장면만 비용이 들어요."}</span></div>
            <div class="mode ${M.mode === "photo" ? "on" : ""}" data-mode="photo"><b>사진만 ${S.boot.engine === "web" ? "(웹 · 추천)" : "(무료·빠름)"}</b><span>올린 사진을 천천히 확대하며 자막·음성을 입혀요. 1분 안팎.</span></div>
          </div>
          <div class="opts">
            <label>배경음악 <select id="o-music">${S.boot.moods.map((m) => `<option ${M.opts.music === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
            <label>목소리 <select id="o-voice">${S.boot.voices.map((v) => `<option ${M.opts.voice === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
            ${isClone() ? `<label>말하기 <select id="o-vmode"><option value="narration" ${M.fields.voice_mode !== "text_only" ? "selected" : ""}>내레이션</option><option value="text_only" ${M.fields.voice_mode === "text_only" ? "selected" : ""}>자막 + 음악만</option></select></label>` : ""}
            <label class="chk"><input type="checkbox" id="o-ailabel" ${M.opts.ai_label ? "checked" : ""}> ‘AI 생성 장면 포함’ 표시</label>
            ${motionOk(M.tpl) && S.boot.engine !== "web" ? `<label class="chk" title="글자가 튀어나오고, 형광펜 강조·배지·X·O 도장·VS·숫자 카운트·가격표 애니메이션이 들어가요"><input type="checkbox" id="o-motion" ${M.opts.motion ? "checked" : ""}> ✨ 모션그래픽 (움직이는 자막·가격표, 베타)</label>` : ""}
          </div>
          <div class="cost" id="cost"></div>
          <button class="btn primary" id="render" style="width:100%;padding:14px">영상 만들기</button>
          <div id="job"></div>
        </section>
      </div>

      <aside class="preview">
        <div class="phone ${t.layout === "letterbox" || t.output === "cards" ? "letterbox" : "full"}" id="phone">
          <div class="video" id="pv-video"></div>
          <div class="t1" id="pv-t1"></div><div class="t2" id="pv-t2"></div>
          <div class="label" id="pv-label"></div>
          <div class="cap" id="pv-cap"></div>
          <div class="info" id="pv-info"></div>
          <div class="ailabel" id="pv-ai">AI 생성 장면 포함</div>
        </div>
        <div class="scene-tabs" id="pv-tabs"></div>
        <div class="note">미리보기는 화면 배치만 보여 줘요. 실제 영상은 장면마다 다른 AI 영상이 들어가요.</div>
      </aside>
    </div>`;

  bindMake();
  updatePreview();
  updateCost();
  runLint();
  if (M.job) showJob(M.job);
  S.previewTimer = setInterval(() => { if (!M.sceneLocked) { M.scene++; updatePreview(); } }, 2600);
}

/* 프레임 묶음 칸 수와, 표지를 뺀 장면 칸 수 */
function frameInfo(a) {
  const labels = a.frames && a.frames.length ? a.frames : ["시작", "25%", "50%", "75%", "표지"];
  const scenesN = labels[labels.length - 1] === "표지" ? labels.length - 1 : labels.length;
  return { n: labels.length, scenesN: Math.max(1, scenesN) };
}

function anatomyMini(a) {
  const fi = frameInfo(a);
  return `<div class="mini-ana">
    <div class="frames small">${Array.from({ length: fi.scenesN }, (_, i) => frameTile(a.meta.id, i, fi.n)).join("")}</div>
    <div><b>${esc(a.summary || "")}</b>
      <div class="muted">${esc(LAYOUT_KO[a.layout] || "")} · ${esc(VOICE_KO[a.voice] || "")} · 장면 ${a.scenes.length}개 · 템포 ${esc(a.pacing || "")}</div>
      <div class="structure" style="margin-top:6px">${a.scenes.map((s) => `<span>${esc(s.label || ROLE_KO[s.role] || s.role)}</span>`).join("<i>→</i>")}</div></div>
  </div>`;
}

function photoUrl() { return S.make.product.photoData || (S.make.info && S.make.info.photo) || ""; }
function aiAvailable() { return S.boot.keys.fal || S.boot.keys.replicate; }

function fieldsHtml(t) {
  const F = S.make.fields;
  let html = (t.fields || []).map((f) => {
    const v = F[f.key];
    if (f.type === "list") {
      const items = v || [];
      const markCls = f.key === "wrong" ? "x" : f.key === "right" ? "o" : "";
      const hasSrc = (f.sources || []).length > 0 && t.output !== "cards";
      return `<div class="field full" data-list="${esc(f.key)}">
        <label>${esc(f.label)} <span class="cnt">${f.min}~${f.max}개</span></label>
        ${items.map((it, i) => `<div class="list-item ${hasSrc ? "" : "nosrc"}">
          <span class="n ${markCls}">${markCls ? (markCls === "x" ? "X" : "O") : i + 1}</span>
          <input type="text" data-li="${esc(f.key)}" data-i="${i}" value="${esc(it.text)}" placeholder="${esc(f.hint || "")}">
          ${hasSrc ? sceneSelect(`data-ls="${esc(f.key)}" data-i="${i}"`, it.source) : ""}
          <button class="icon-btn" data-del="${esc(f.key)}" data-i="${i}" title="삭제" ${items.length <= f.min ? "disabled" : ""}>×</button>
        </div>`).join("")}
        ${items.length < f.max ? `<button class="btn small ghost" data-add="${esc(f.key)}">＋ 추가</button>` : ""}
        ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}
      </div>`;
    }
    if (f.type === "source") {
      return `<div class="field"><label>${esc(f.label)}</label>${sceneSelect(`data-k="${esc(f.key)}"`, v || f.default)}</div>`;
    }
    const full = ["hook", "outro", "reveal", "verdict", "line1", "line2", "a_say", "b_say", "hook_text", "cta", "outro_card", "info"].includes(f.key);
    const len = String(v ?? "").replace(/\*/g, "").length;
    return `<div class="field ${full ? "full" : ""}">
      <label>${esc(f.label)} ${f.max ? `<span class="cnt ${len > f.max ? "over" : ""}" data-cnt="${esc(f.key)}">${len}/${f.max}</span>` : ""}</label>
      <input type="${f.type === "number" ? "number" : "text"}" data-k="${esc(f.key)}" value="${esc(v ?? "")}" placeholder="${esc(f.hint || "")}">
    </div>`;
  }).join("");
  if (isClone()) {
    const a = S.analysis[S.make.ref];
    const n = a.scenes.length, fr = frameInfo(a);
    html += `<div class="field full"><label>장면 (레퍼런스 ↔ 내 영상)</label>
      ${(F.lines || []).map((ln, i) => {
        const s = a.scenes[i];
        const role = ln.role || (s && s.role) || "TIP";
        const fi = n > 1 ? Math.min(fr.scenesN - 1, Math.round((i / (n - 1)) * (fr.scenesN - 1))) : 0;
        return `<div class="clone-row">
          <div class="ref-side">${s ? frameTile(a.meta.id, fi, fr.n, "ftile sm") : `<div class="ftile sm"></div>`}<div><span class="role r-${esc(role)}">${esc(ln.label || ROLE_KO[role] || role)}</span><div class="muted">${esc(s ? s.purpose || s.text || "" : "말로 고치기에서 추가한 장면")}</div></div></div>
          <div class="my-side">
            <input type="text" data-cl="${i}" value="${esc(ln.say)}" placeholder="이 장면에서 할 말">
            <div class="row2"><input type="text" data-cll="${i}" value="${esc(ln.label)}" placeholder="라벨 (예: TIP 1)">${sceneSelect(`data-cls="${i}"`, ln.source)}</div>
          </div></div>`;
      }).join("")}</div>`;
  }
  return html;
}

function sceneSelect(attr, val) {
  return `<select ${attr}>${S.boot.scenes.map((s) => `<option value="${s.id}" ${s.id === val ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>`;
}

/* 초안이 없을 때 리스트 칸을 빈 줄로 준비 */
// 모션그래픽은 카드(사진 묶음)만 빼고 모든 영상 템플릿·레퍼런스 복제에 쓸 수 있다
const motionOk = (tpl) => tpl === "clone" || ((S.boot.templates[tpl] || {}).output !== "cards" && !!S.boot.templates[tpl]);

function ensureFields(t) {
  const F = S.make.fields;
  for (const f of t.fields || []) {
    if (f.type === "list" && !F[f.key]) {
      F[f.key] = Array.from({ length: f.count || f.min || 1 }, (_, i) => ({ text: "", source: (f.sources || [])[i % Math.max(1, (f.sources || []).length)] || "photo:1" }));
    }
    if (f.type === "source" && !F[f.key]) F[f.key] = f.default;
  }
}

function bindMake() {
  const M = S.make, t = curTpl();
  ensureFields(t);
  $("#fields").innerHTML = fieldsHtml(t);

  const ts = $("#tpl-sel"); if (ts) ts.onchange = (e) => { location.hash = `#/make?tpl=${encodeURIComponent(e.target.value)}&ref=`; };
  const rs = $("#ref-sel"); if (rs) rs.onchange = (e) => { M.ref = e.target.value || null; renderMake(); };
  const rv = $("#ref-view"); if (rv) rv.onclick = () => openRef(M.ref);

  const ps = $("#prod-sel");
  if (ps) ps.onchange = () => {
    const p = S.boot.products.find((x) => x.folder === ps.value);
    // 다른 상품으로 바꾸면 이전 상품의 문구·결과·대화는 비운다
    M.job = null; M.chat = []; M.drafted = false;
    M.fields = isClone() ? {} : {};
    if (!p) { M.info = null; M.product = freshMake().product; renderMake(); return; }
    M.info = p;
    M.product = { name: p.name, category: p.category || "", origin: p.origin || "", price: p.price || "", unit: p.unit || "", memo: p.memo || "", photoData: null };
    renderMake();
  };

  const drop = $("#drop"), input = $("#photo");
  input.onchange = () => input.files[0] && loadPhoto(input.files[0]);
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) loadPhoto(f); });

  const bindP = (id, key) => { $(id).oninput = (e) => { M.product[key] = e.target.value; }; };
  bindP("#p-name", "name"); bindP("#p-origin", "origin"); bindP("#p-unit", "unit"); bindP("#p-price", "price"); bindP("#p-memo", "memo");
  $("#p-cat").onchange = (e) => { M.product.category = e.target.value; };
  $("#save-prod").onclick = saveProduct;
  $("#draft").onclick = makeDraft;
  document.querySelectorAll(".mode").forEach((el) => el.addEventListener("click", () => {
    if (el.classList.contains("disabled")) return;
    M.mode = el.dataset.mode;
    document.querySelectorAll(".mode").forEach((x) => x.classList.toggle("on", x === el));
    updateCost(); updatePreview();
  }));
  $("#o-music").onchange = (e) => { M.opts.music = e.target.value; };
  $("#o-voice").onchange = (e) => { M.opts.voice = e.target.value; };
  $("#o-ailabel").onchange = (e) => { M.opts.ai_label = e.target.checked; updatePreview(); };
  const mo = $("#o-motion"); if (mo) mo.onchange = (e) => { M.opts.motion = e.target.checked; };
  const vm = $("#o-vmode"); if (vm) vm.onchange = (e) => { M.fields.voice_mode = e.target.value; };
  $("#render").onclick = startRender;
  const pb = $("#plan-btn"); if (pb) pb.onclick = openPlan;
  bindFields();
}

function bindFields() {
  const M = S.make, box = $("#fields");
  box.oninput = (e) => {
    const t = curTpl(), el = e.target;
    if (el.dataset.k) {
      M.fields[el.dataset.k] = el.value;
      const f = t.fields.find((x) => x.key === el.dataset.k);
      const c = box.querySelector(`[data-cnt="${el.dataset.k}"]`);
      if (c && f) { const len = el.value.replace(/\*/g, "").length; c.textContent = `${len}/${f.max}`; c.classList.toggle("over", len > f.max); }
    }
    if (el.dataset.li) M.fields[el.dataset.li][+el.dataset.i].text = el.value;
    if (el.dataset.cl !== undefined) M.fields.lines[+el.dataset.cl].say = el.value;
    if (el.dataset.cll !== undefined) M.fields.lines[+el.dataset.cll].label = el.value;
    lockSceneFor(el);
    updatePreview();
    clearTimeout(S.lintTimer); S.lintTimer = setTimeout(runLint, 500);
  };
  box.onchange = (e) => {
    const el = e.target;
    if (el.dataset.ls) M.fields[el.dataset.ls][+el.dataset.i].source = el.value;
    else if (el.dataset.cls !== undefined) M.fields.lines[+el.dataset.cls].source = el.value;
    else if (el.tagName === "SELECT" && el.dataset.k) M.fields[el.dataset.k] = el.value;
    updatePreview(); updateCost();
  };
  box.onclick = (e) => {
    const t = curTpl(), el = e.target.closest("button"); if (!el) return;
    e.preventDefault();
    if (el.dataset.add) {
      const f = t.fields.find((x) => x.key === el.dataset.add), arr = M.fields[f.key];
      arr.push({ text: "", source: (f.sources || [])[arr.length % Math.max(1, (f.sources || []).length)] || "photo:1" });
    } else if (el.dataset.del) M.fields[el.dataset.del].splice(+el.dataset.i, 1);
    else return;
    box.innerHTML = fieldsHtml(t); updatePreview(); updateCost();
  };
}

/* 광고 문구 점검 (식품 표시·광고법에서 문제 되기 쉬운 표현) */
function allTexts() {
  const out = [];
  for (const v of Object.values(S.make.fields)) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => out.push(typeof x === "string" ? x : x.text || x.say || ""));
  }
  return out.filter(Boolean);
}
async function runLint() {
  const box = $("#lint"); if (!box) return;
  try {
    const { hits } = await api("/api/lint", { texts: allTexts(), product: S.make.info && S.make.info.folder });
    box.innerHTML = hits.length ? `<div class="lint"><b>⚠ 광고 문구 점검 ${hits.length}건</b> <span class="muted">식품 광고에서 자주 문제 되는 표현이에요 (법률 검토를 대신하지는 않아요)</span>
      ${hits.map((h) => `<div><mark>${esc(h.word)}</mark> — ${esc(h.why)}<div class="muted">“${esc(h.text)}” → ${esc(h.tip || "")}</div></div>`).join("")}</div>` : "";
  } catch (e) { /* 무시 */ }
}

function lockSceneFor(el) {
  const scenes = buildScenes();
  let idx = -1;
  if (el.dataset.cl !== undefined || el.dataset.cll !== undefined) idx = +(el.dataset.cl ?? el.dataset.cll);
  else {
    const key = el.dataset.k || el.dataset.li;
    idx = scenes.findIndex((s) => s.key === key && (el.dataset.i === undefined || s.i === +el.dataset.i));
  }
  if (idx >= 0) { S.make.scene = idx; S.make.sceneLocked = true; }
}

function loadPhoto(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    S.make.product.photoData = c.toDataURL("image/jpeg", 0.9);
    URL.revokeObjectURL(url);
    const ph = $("#ph"); ph.style.backgroundImage = `url('${S.make.product.photoData}')`; ph.textContent = "";
    updatePreview();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    // 아이폰 사진(HEIC)은 브라우저가 못 그려서 파일 그대로 보내 스튜디오가 바꾼다
    if (!/\.hei[cf]$/i.test(file.name) && !/hei[cf]/i.test(file.type)) return toast("사진을 읽지 못했어요. JPG나 PNG로 올려 주세요.", true);
    const r = new FileReader();
    r.onload = () => {
      S.make.product.photoData = r.result;
      const ph = $("#ph"); ph.style.backgroundImage = ""; ph.textContent = "HEIC";
      toast("아이폰 사진이에요. 저장하면 스튜디오가 JPG로 바꿔요.");
    };
    r.readAsDataURL(file);
  };
  img.src = url;
}

async function saveProduct() {
  const M = S.make, btn = $("#save-prod");
  if (!M.product.name.trim()) return toast("상품명을 입력해 주세요", true);
  if (!M.product.photoData && !(M.info && M.info.photo)) return toast("사진을 한 장 올려 주세요", true);
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span> 사진 분석 중…`;
  try {
    const body = { name: M.product.name, category: M.product.category, origin: M.product.origin, unit: M.product.unit, price: M.product.price, memo: M.product.memo };
    if (M.product.photoData) body.photo = M.product.photoData;
    if (M.info) body.from = M.info.folder;  // 이름만 바꿔 저장해도 사진을 이어받는다
    M.info = await api("/api/product", body);
    M.product.photoData = null;
    M.product.category = M.info.category || M.product.category;
    S.boot.products = await api("/api/products");
    toast("상품을 저장했어요");
    renderMake();
  } catch (e) {
    toast(e.message, true); btn.disabled = false; btn.textContent = "상품 저장 · 사진 분석";
  }
}

async function makeDraft() {
  const M = S.make, t = curTpl(), btn = $("#draft");
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span> 쓰는 중… (10~30초)`;
  try {
    if (isClone()) {
      const d = await api("/api/clone/draft", { product: M.info.folder, ref: M.ref });
      M.fields = { ...d.fields, voice_mode: M.fields.voice_mode };
      M.via = d.via;
    } else {
      const d = await api("/api/draft", { product: M.info.folder, template: M.tpl, ref: M.ref });
      const old = M.fields;
      M.fields = {};
      for (const f of t.fields) {
        const v = d.fields[f.key];
        if (f.type === "list") {
          M.fields[f.key] = (v || []).map((text, i) => ({ text, source: (old[f.key] && old[f.key][i] && old[f.key][i].source) || (f.sources || [])[i % Math.max(1, (f.sources || []).length)] || "photo:1" }));
        } else if (f.type === "source") M.fields[f.key] = old[f.key] || f.default;
        else M.fields[f.key] = v ?? "";
      }
      M.via = d.via;
    }
    M.drafted = true; M.scene = 0; M.sceneLocked = false;
    renderMake();
  } catch (e) {
    toast(e.message, true); btn.disabled = false; btn.textContent = "AI 문구 초안 만들기";
  }
}

/* 미리보기 장면 목록 */
function buildScenes() {
  const M = S.make, t = curTpl(), F = M.fields;
  const ctx = { ...(M.info || {}), name: (M.info && M.info.name) || M.product.name || "상품", ...flat(F) };
  if (isClone()) {
    const a = S.analysis[M.ref];
    return (F.lines || []).map((ln, i) => {
      const role = ln.role || ((a && a.scenes[i]) || {}).role || "TIP";
      return { key: "lines", i, cap: ln.say, label: role === "WRONG" || role === "RIGHT" ? "" : ln.label, mark: role === "WRONG" ? "X" : role === "RIGHT" ? "O" : "", src: ln.source };
    });
  }
  if (t.engine === "short") {
    // make_short.py 의 장면 순서와 같게 (특징 장면은 detail → hero → 스톡, 먹는 장면은 항상)
    const sc = [{ key: "hook_text", cap: F.hook_text, src: "ai:hook" }, { key: "origin", cap: `${F.origin || "산지"}에서 바로 보내드려요.`, src: "stock:origin" }];
    (F.features || []).forEach((x, i) => sc.push({ key: "features", i, cap: x.text, src: ["ai:detail", "ai:hero", "stock:product"][i] || "ai:hero" }));
    sc.push({ key: "crave", cap: "(먹는 장면 · 자동 문구)", src: "ai:crave" });
    if (F.price) sc.push({ key: "price", cap: `지금 ${Number(F.price).toLocaleString()}원에 드려요.`, src: "ai:hero" });
    sc.push({ key: "cta", cap: F.cta, src: "ai:hero" });
    return sc;
  }
  if (t.output === "cards") {
    const sc = [{ key: "title1", cap: "", src: "ai:hook", cover: true }];
    (F.items || []).forEach((x, i) => sc.push({ key: "items", i, cap: x.text, label: String(i + 1), src: x.source }));
    sc.push({ key: "outro_card", cap: F.outro_card, src: "ai:hero" });
    return sc;
  }
  const out = [];
  for (const s of t.segments || []) {
    if (s.each) {
      (F[s.each] || []).forEach((it, i) => {
        const c = { ...ctx, text: it.text, source: it.source, n: i + 1 };
        out.push({ key: s.each, i, cap: fill(s.say, c), label: s.label ? fill(s.label, c) : "", mark: s.mark, src: it.source });
      });
    } else {
      const cap = fill(s.say || s.text || "", ctx);
      if (s.optional && !cap) continue;
      const key = ((s.say || "").match(/\{(\w+)/) || [])[1];
      out.push({ key, cap, label: s.label ? fill(s.label, ctx) : "", mark: s.mark, src: fill(s.source || "", ctx), counter: s.counter ? fill(s.counter, ctx) + fill(s.unit || "", ctx) : "" });
    }
  }
  return out;
}
function flat(F) { const o = {}; for (const [k, v] of Object.entries(F)) if (!Array.isArray(v)) o[k] = v; return o; }

function cachedFrame(src) {
  const M = S.make;
  if (!M.info || !src || !src.startsWith("ai:")) return "";
  const shot = src.slice(3);
  return M.info.cached.includes(shot) ? `${API}/media/products/${encodeURIComponent(M.info.folder)}/_clips/ai_${shot}.jpg` : "";
}

function updatePreview() {
  const M = S.make, t = curTpl();
  if (!$("#phone")) return;
  const scenes = buildScenes();
  if (!scenes.length) return;
  const i = ((M.scene % scenes.length) + scenes.length) % scenes.length;
  const s = scenes[i];
  const ctx = { ...(M.info || {}), name: (M.info && M.info.name) || M.product.name || "상품", ...flat(M.fields) };
  const bg = (M.mode === "ai" && cachedFrame(s.src)) || photoUrl();
  $("#pv-video").style.backgroundImage = bg ? `url('${bg}')` : "";
  const a = isClone() ? S.analysis[M.ref] : null;
  const hlColor = a && a.caption && a.caption.color === "green" ? "#5ae65a" : a && a.caption && a.caption.color === "red" ? "#ff5046" : "";
  $("#phone").style.setProperty("--hl", hlColor || "var(--accent)");
  $("#pv-t1").textContent = t.engine === "short" ? "" : fill(t.title ? t.title[0] : "", ctx);
  $("#pv-t2").textContent = fill(t.title ? t.title[1] : "", ctx) || "";
  $("#pv-t1").hidden = !$("#pv-t1").textContent;
  $("#pv-info").textContent = fill(t.info || "", ctx);
  $("#pv-info").hidden = !$("#pv-info").textContent;
  $("#pv-ai").hidden = !(M.opts.ai_label && M.mode === "ai");
  const lab = $("#pv-label");
  if (s.mark) lab.innerHTML = `<span style="display:inline-grid;place-items:center;width:20cqw;height:20cqw;border-radius:50%;border:2px solid #fff;color:#fff;font-size:15cqw;background:${s.mark === "O" ? "#3cc85a" : "#eb3232"}">${s.mark}</span>`;
  else if (s.counter) lab.innerHTML = `<span style="font-size:16cqw;padding:0 4cqw;border-radius:8px;background:rgba(0,0,0,.55)">${esc(s.counter)}</span>`;
  else lab.textContent = s.label || "";
  lab.style.top = s.mark ? "52%" : s.counter ? "36%" : "";
  $("#pv-cap").innerHTML = s.cover ? "" : t.engine === "short" || t.output === "cards" ? esc((s.cap || "…").replace(/\*/g, "")) : hl(s.cap || "…");
  $("#pv-tabs").innerHTML = scenes.map((x, k) => `<button class="${k === i ? "on" : ""}" data-sc="${k}">${k + 1}</button>`).join("") +
    `<button data-sc="auto" class="${M.sceneLocked ? "" : "on"}">자동</button>`;
  $("#pv-tabs").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sc === "auto") M.sceneLocked = false; else { M.scene = +b.dataset.sc; M.sceneLocked = true; }
    updatePreview();
  };
}

function usedSources() { return [...new Set(buildScenes().map((s) => s.src).filter(Boolean))]; }

function updateCost() {
  const M = S.make, el = $("#cost"); if (!el) return;
  const t = curTpl();
  if (t.output === "cards") { el.innerHTML = "카드는 이미 만든 AI 장면 사진이 있으면 그걸 배경으로, 없으면 올린 사진으로 만들어요. <b>추가 비용 없음.</b>"; return; }
  if (M.mode === "photo") { el.innerHTML = "사진만 사용 · <b>AI 장면 비용 없음</b> · 음성(무료 TTS)·자막·전환·배경음악이 들어가요."; return; }
  const cached = new Set((M.info && M.info.cached) || []);
  const ai = usedSources().filter((s) => s.startsWith("ai:")).map((s) => s.slice(3));
  const fresh = ai.filter((s) => !cached.has(s));
  const label = (id) => (S.boot.scenes.find((x) => x.id === "ai:" + id) || {}).label || id;
  el.innerHTML = `AI 장면 ${ai.length}개 사용 · <b>새로 만들 장면 ${fresh.length}개</b>${fresh.length ? ` (${fresh.map(label).map(esc).join(", ")}) · 예상 비용 약 ${(fresh.length * 800).toLocaleString()}원` : " · 추가 비용 없음"}<br>
    <span class="muted">새 장면 하나에 약 800원(장면 사진 1장 + 5초 영상, 2026년 11월 요금 기준 추정)이고 1~3분 걸려요. 한 번 만든 장면은 다음 영상에서 무료예요. 만든 뒤 Claude가 실물 사진과 같은지 점검해요.</span>`;
}

function collectFields() {
  const M = S.make, t = curTpl(), out = {};
  for (const f of t.fields) {
    const v = M.fields[f.key];
    if (f.type === "list") out[f.key] = (v || []).filter((x) => x.text.trim()).map((x) => ({ text: x.text.trim(), source: x.source }));
    else out[f.key] = typeof v === "string" ? v.trim() : v;
  }
  if (isClone()) {
    out.lines = (M.fields.lines || []).map((l) => ({ say: (l.say || "").trim(), label: l.label, role: l.role, source: l.source }));
    out.voice_mode = M.fields.voice_mode;
  }
  return { ...out, music: M.opts.music, voice: M.opts.voice, ai_label: M.opts.ai_label,
    motion: motionOk(M.tpl) && M.opts.motion };
}

function validate() {
  const t = curTpl(), F = collectFields(), errs = [];
  for (const f of t.fields) {
    const v = F[f.key];
    if (f.type === "list" && v.length < (f.min || 1)) errs.push(`${f.label}을(를) ${f.min}개 이상 써 주세요`);
    const required = ["hook", "line1", "hook_text", "reveal", "a_say", "b_say", "verdict"].concat(isClone() ? [] : ["title1"]);
    if (required.includes(f.key) && !v) errs.push(`${f.label}이(가) 비어 있어요`);
    if (f.key === "count" && t.id === "물량리빌" && !v) errs.push("개수(숫자)를 넣어 주세요");
  }
  if (isClone() && F.lines.some((l) => !l.say)) errs.push("비어 있는 장면 문장이 있어요. 초안을 만들거나 직접 써 주세요");
  return errs;
}

async function startRender() {
  const M = S.make;
  const errs = validate();
  if (errs.length) return toast(errs[0], true);
  const btn = $("#render");
  btn.disabled = true;
  try {
    const mode = S.boot.engine === "web" ? "photo" : M.mode;
    const fields = collectFields();
    if (S.boot.engine === "web") fields.motion = false;
    const job = await api("/api/render", { product: M.info.folder, template: M.tpl, ref: M.ref, mode, fields });
    M.job = job.id;
    showJob(job.id);
    refreshBadge();
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}

async function showJob(id) {
  clearTimeout(S.poll);
  const box = $("#job"); if (!box) return;
  let j;
  try { j = await api("/api/jobs/" + encodeURIComponent(id)); } catch (e) { box.innerHTML = ""; return; }
  const btn = $("#render");
  if (j.status === "queued" || j.status === "running") {
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> 만드는 중…`; }
    box.innerHTML = `<div class="progress"><div class="bar"><i></i></div>
      <div style="margin-top:6px"><b>${j.status === "queued" ? "앞 작업이 끝나면 시작해요" : esc(friendlyStep(j.log))}</b></div>
      <details><summary class="muted">자세한 진행 기록</summary><div class="log">${esc(j.log.slice(-14).join("\n")) || "시작하는 중…"}</div></details></div>`;
    S.poll = setTimeout(() => showJob(id), 2000);
    return;
  }
  if (btn) { btn.disabled = false; btn.textContent = "다시 만들기"; }
  refreshBadge();
  if (j.status === "error") {
    box.innerHTML = `<div class="progress"><div class="status error">만들지 못했어요</div><p>${esc(j.error || "")}</p>
      <details><summary class="muted">자세한 기록 (문제를 알릴 때 보여 주세요)</summary><div class="log">${esc(j.log.slice(-30).join("\n"))}</div></details></div>`;
    return;
  }
  box.innerHTML = resultHtml(j) + fidelityHtml(j) + chatHtml();
  bindResult(j);
}

/* 진행 기록 한 줄 → 쉬운 말 */
function friendlyStep(log) {
  const total = log.filter((l) => /^\s+\[/.test(l)).length;
  for (const l of [...log].reverse()) {
    let m;
    if ((m = l.match(/AI 장면 사진 생성: (\w+)/))) return `AI가 ‘${SHOT_KO[m[1]] || m[1]}’ 장면 사진을 만드는 중 (장면 ${total + 1})`;
    if ((m = l.match(/AI 영상 생성: (\w+)/))) return `‘${SHOT_KO[m[1]] || m[1]}’ 장면을 5초 영상으로 바꾸는 중… 1~3분 걸려요`;
    if (/배경음악 생성/.test(l)) return "배경음악을 만드는 중 (처음 한 번만)";
    if (/스톡 영상/.test(l)) return "산지 풍경 영상을 찾는 중";
    if (/^\s+\[/.test(l)) return `장면 ${total}개 완성 · 다음 장면 준비 중`;
    if (/→/.test(l)) return "장면을 이어 붙이는 중";
  }
  return "준비 중";
}

function resultHtml(j) {
  const r = j.result;
  if (r.type === "cards") {
    return `<div class="progress"><div class="status done">✓ 카드 ${r.files.length}장 완성</div>
      <div class="cards" style="margin-top:10px">${r.files.map((f) => `<a href="${f}" download><img src="${f}" alt=""></a>`).join("")}</div>
      <div class="muted" style="margin-top:6px">카드를 눌러 한 장씩 저장하세요. 인스타 캐러셀·틱톡 사진 모드에 올리면 돼요.</div></div>`;
  }
  return `<div class="result">
    <video src="${r.file}" controls playsinline preload="metadata"></video>
    <div>
      <div class="status done">✓ 완성${j.used_ai ? " · AI 장면 새로 생성됨" : ""}</div>
      <p class="muted">${esc(j.product)} · ${esc(j.template_name)} · ${esc(j.finished || "")}</p>
      <div class="cta-row">
        <a class="btn primary" href="${r.file}" download>영상 저장 (mp4)</a>
        <button class="btn yellow" id="post-btn">📋 올릴 글 만들기</button>
        <button class="btn" id="hooks-btn">첫 문장만 다른 3편 (A/B)</button>
      </div>
      <div class="muted" style="margin-top:6px">휴대폰에 옮길 때: 저장한 mp4를 카카오톡 ‘나와의 채팅’이나 휴대폰 연결로 보내면 돼요.</div>
      <div id="post-box">${j.post ? postHtml(j.post, []) : ""}</div>
      ${r.script ? `<details style="margin-top:12px"><summary>대본 보기</summary><div class="script">${esc(r.script)}</div></details>` : ""}
    </div></div>`;
}

const PLATFORM_KO = { youtube: "유튜브 쇼츠", instagram: "인스타 릴스", tiktok: "틱톡", naver: "네이버 클립" };
function postHtml(post, lint) {
  return `<div class="post">${(lint || []).length ? `<div class="lint"><b>⚠ 올릴 글 점검 ${lint.length}건</b>${lint.map((h) => `<div><mark>${esc(h.word)}</mark> — ${esc(h.why)}</div>`).join("")}</div>` : ""}
    ${Object.entries(post).filter(([, v]) => v && typeof v === "object").map(([k, v]) => {
      const text = [v.title, v.caption || v.description, (v.tags || []).join(" ")].filter(Boolean).join("\n\n");
      return `<div class="post-card"><div class="post-head"><b>${esc(PLATFORM_KO[k] || k)}</b><button class="btn small" data-copy="${esc(text)}">복사</button></div><div class="script">${esc(text)}</div></div>`;
    }).join("")}</div>`;
}
function bindCopy() {
  document.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("복사했어요"); }
    catch (e) { toast("복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요", true); }
  });
}

/* 첫 문장만 바꾼 3편: 장면은 다시 쓰므로 AI 장면 비용이 들지 않는다 */
function hookKey() {
  const M = S.make;
  if (isClone()) return "lines";
  return ["hook", "line1", "hook_text"].find((k) => k in M.fields) || null;
}
async function makeHookAB(btn) {
  const M = S.make, key = hookKey();
  if (!key) return toast("이 형식은 첫 문장을 바꿀 수 없어요", true);
  const cur = collectFields();
  const hook = key === "lines" ? (cur.lines[0] || {}).say : cur[key];
  const rest = key === "lines" ? cur.lines.slice(1).map((l) => l.say) : allTexts().filter((t) => t !== hook);
  btn.disabled = true; btn.innerHTML = `<span class="spin"></span> 훅 쓰는 중…`;
  try {
    const { hooks } = await api("/api/hooks", { product: M.info.folder, kind: curTpl().name, hook, rest });
    for (const h of hooks) {
      const f = JSON.parse(JSON.stringify(cur));
      if (key === "lines") f.lines[0].say = h.text; else f[key] = h.text;
      await api("/api/render", { product: M.info.folder, template: M.tpl, ref: M.ref, mode: M.mode, fields: f });
    }
    toast(`첫 문장만 다른 ${hooks.length}편을 만들기 시작했어요: ${hooks.map((h) => h.type).join(" · ")}`);
    location.hash = "#/jobs";
  } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = "첫 문장만 다른 3편 (A/B)"; }
}

function fidelityHtml(j) {
  const f = (j.fidelity || []).filter((x) => x.shot && x.shot !== "?");
  if (!f.length) return "";
  const bad = f.filter((x) => x.score !== null && x.score < 7);
  const notPhoto = f.some((x) => x.ref_is_photo === false);
  return `<div class="fidelity">
    <h3>실물 일치 점검 <span class="muted">· Claude가 AI 장면과 올린 사진을 비교했어요</span></h3>
    ${notPhoto ? `<p class="lint" style="margin:0 0 8px">올린 이미지가 실제 사진이 아니라 그림이라 정확히 비교하기 어려워요. 실제 상품 사진으로 다시 올려 주세요.</p>` : ""}
    <p class="muted" style="margin:0 0 8px">${bad.length ? `<b style="color:var(--red)">${bad.length}개 장면</b>이 실제 상품과 다르게 보일 수 있어요. 생물 상품은 ‘영상과 달라요’가 반품·낮은 별점으로 이어지니, 다시 만들기를 권해요.` : "모든 AI 장면이 실제 상품과 같은 상품으로 보여요."}</p>
    <div class="fid-grid">${f.map((x) => `<div class="fid ${x.score !== null && x.score < 7 ? "bad" : ""}">
      <div class="fimg" style="background-image:url('${API}/media/products/${encodeURIComponent(j.product)}/_clips/ai_${esc(x.shot)}.jpg?${Date.now() % 1e5}')"></div>
      <div><b>${esc(SHOT_KO[x.shot] || x.shot)}</b> <span class="score">${x.score ?? "?"}/10</span>
      <div class="muted">${esc(x.issue || "실물과 같아 보여요")}</div>
      ${x.score !== null && x.score < 7 ? `<div class="fid-actions"><button class="btn small" data-myphoto="${esc(x.shot)}">내 사진으로 바꾸기 (무료)</button><button class="btn small ghost" data-reshoot="${esc(x.shot)}">AI로 다시 만들기</button></div>` : ""}</div>
    </div>`).join("")}</div></div>`;
}

function chatHtml() {
  const M = S.make;
  return `<div class="chat panel">
    <h3>말로 고치기 <span class="muted">· Claude가 설정을 고친 뒤 다시 만들어요</span></h3>
    <div class="chat-log" id="chat-log">${M.chat.map((c) => `<div class="msg ${c.who}">${esc(c.text)}</div>`).join("") ||
      `<div class="muted">예: “첫 문장을 더 궁금하게 바꿔줘”, “남자 목소리로, 음악은 잔잔하게”, “2번째 장면 빼고 먹는 장면 하나 추가해줘”</div>`}</div>
    <form id="chat-form" class="chat-in"><input type="text" id="chat-text" placeholder="어떻게 고칠까요?"><button class="btn primary">보내기</button></form>
    <label class="chk" style="margin-top:6px"><input type="checkbox" id="chat-auto" checked> 고친 다음 바로 다시 만들기</label>
  </div>`;
}

/* 실물과 다른 AI 장면을 올린 사진 컷으로 바꾼다 (비용 없음) */
function useMyPhoto(shot) {
  const M = S.make, src = "ai:" + shot;
  let n = 0;
  for (const [k, v] of Object.entries(M.fields)) {
    if (v === src) { M.fields[k] = "photo:1"; n++; }
    else if (Array.isArray(v)) v.forEach((x) => { if (x && x.source === src) { x.source = "photo:1"; n++; } });
  }
  return n;
}

function bindResult(j) {
  const M = S.make;
  bindCopy();
  document.querySelectorAll("[data-myphoto]").forEach((b) => b.onclick = () => {
    const n = useMyPhoto(b.dataset.myphoto);
    if (!n) return toast("이 영상에서는 바꿀 장면이 없어요 (판매형은 장면이 고정이에요). ‘AI로 다시 만들기’를 써 주세요.", true);
    $("#fields").innerHTML = fieldsHtml(curTpl()); updatePreview(); updateCost();
    toast(`${n}개 장면을 내 사진 컷으로 바꿨어요. 다시 만들게요.`);
    startRender();
  });
  const pbtn = $("#post-btn");
  if (pbtn) pbtn.onclick = async () => {
    pbtn.disabled = true; pbtn.innerHTML = `<span class="spin"></span> 쓰는 중…`;
    try { const d = await api("/api/post", { job: j.id }); $("#post-box").innerHTML = postHtml(d.post, d.lint); bindCopy(); }
    catch (e) { toast(e.message, true); }
    pbtn.disabled = false; pbtn.textContent = "📋 올릴 글 다시 쓰기";
  };
  const hbtn = $("#hooks-btn");
  if (hbtn) hbtn.onclick = () => makeHookAB(hbtn);
  document.querySelectorAll("[data-reshoot]").forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try {
      const d = await api("/api/reshoot", { product: j.product, shot: b.dataset.reshoot });
      M.info = d.product;
      toast("이 장면을 치워 뒀어요. ‘다시 만들기’를 누르면 새로 만들어요.");
      updateCost();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  });
  const form = $("#chat-form");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#chat-text").value.trim(); if (!text) return;
    M.chat.push({ who: "me", text });
    const log = $("#chat-log");
    log.innerHTML = M.chat.map((c) => `<div class="msg ${c.who}">${esc(c.text)}</div>`).join("") + `<div class="msg ai"><span class="spin"></span> 고치는 중…</div>`;
    const btn = form.querySelector("button"); btn.disabled = true;
    try {
      const fields = { ...collectFields() };
      const d = await api("/api/chat", { product: M.info.folder, template: M.tpl, ref: M.ref, fields, message: text });
      applyFields(d.fields);
      M.chat.push({ who: "ai", text: d.reply });
      const auto = $("#chat-auto").checked;
      $("#fields").innerHTML = fieldsHtml(curTpl()); updatePreview(); updateCost(); runLint();
      log.innerHTML = M.chat.map((c) => `<div class="msg ${c.who}">${esc(c.text)}</div>`).join("");
      $("#chat-text").value = "";
      if (auto) startRender();
    } catch (err) { M.chat.pop(); toast(err.message, true); log.innerHTML = M.chat.map((c) => `<div class="msg ${c.who}">${esc(c.text)}</div>`).join(""); }
    btn.disabled = false;
  };
}

/* 대화 수정 결과를 화면 상태로 */
function applyFields(nf) {
  const M = S.make;
  if (nf.music) M.opts.music = nf.music;
  if (nf.voice) M.opts.voice = nf.voice;
  if (nf.ai_label !== undefined) M.opts.ai_label = !!nf.ai_label;
  for (const [k, v] of Object.entries(nf)) {
    if (["music", "voice", "ai_label", "motion"].includes(k)) continue;
    if (k === "lines" && Array.isArray(v)) M.fields.lines = v.map((l) => ({ say: l.say || l.text || "", label: l.label || "", role: l.role || "TIP", source: l.source || "ai:hero" }));
    else if (Array.isArray(v)) M.fields[k] = v.map((x) => ({ text: x.text || x.say || "", source: x.source || "photo:1" }));
    else M.fields[k] = v;
  }
  const om = $("#o-music"); if (om) om.value = M.opts.music;
  const ov = $("#o-voice"); if (ov) ov.value = M.opts.voice;
}

/* ---------- 일주일치 기획 ---------- */
async function openPlan() {
  const M = S.make, m = $("#modal");
  m.innerHTML = `<div class="modal-box plan-box"><button class="modal-close">×</button><div class="modal-info" id="plan-body">
    <h2>${esc(M.info.name)} · 일주일 숏폼 기획</h2><div class="anatomy"><span class="spin"></span> Claude가 분석해 둔 레퍼런스 중에서 고르는 중… (20~40초)</div></div></div>`;
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ""; };
  $(".modal-close", m).onclick = close;
  m.onclick = (e) => { if (e.target === m) close(); };
  let d;
  try { d = await api("/api/plan", { product: M.info.folder, n: 5 }); }
  catch (e) { $("#plan-body").innerHTML += `<div class="lint">${esc(e.message)}</div>`; return; }
  const body = $("#plan-body"); if (!body) return;
  body.innerHTML = `<h2>${esc(M.info.name)} · 일주일 숏폼 기획</h2>
    ${d.note ? `<div class="formula"><b>이번 주 운영 팁</b><p>${esc(d.note)}</p></div>` : ""}
    <div class="plan-list">${d.plan.map((x, i) => `<label class="plan-item">
      <input type="checkbox" data-pi="${i}" checked>
      <span class="day">${esc(x.day)}</span>
      <img src="${thumb(x.ref)}" onerror="thumbFallback(this,'${esc(x.ref)}')" alt="">
      <div><b>${esc(x.title)}</b><div class="muted">${views(x.views)}회 · ${esc(shortName(x.template))} · ${esc(x.platform || "")} · 목표: ${esc(x.goal || "")}</div><div>${esc(x.why)}</div></div>
    </label>`).join("")}</div>
    <div class="modes" style="margin-top:12px">
      <div class="mode on" data-pm="photo"><b>사진만 (무료)</b><span>먼저 문구·흐름을 확인할 때</span></div>
      <div class="mode ${aiAvailable() ? "" : "disabled"}" data-pm="ai"><b>AI 장면</b><span>새 장면만 비용. 같은 상품끼리 장면을 함께 써요</span></div>
    </div>
    <button class="btn primary big" id="plan-run" style="width:100%">선택한 영상 모두 만들기</button>
    <div class="muted">문구는 Claude가 자동으로 쓰고, 다 만든 뒤 ‘만든 영상’에서 열어 고칠 수 있어요. 광고 문구 점검 결과도 함께 표시돼요.</div>`;
  let pm = "photo";
  body.querySelectorAll("[data-pm]").forEach((el) => el.onclick = () => {
    if (el.classList.contains("disabled")) return;
    pm = el.dataset.pm; body.querySelectorAll("[data-pm]").forEach((x) => x.classList.toggle("on", x === el));
  });
  $("#plan-run").onclick = async () => {
    const items = d.plan.filter((_, i) => body.querySelector(`[data-pi="${i}"]`).checked).map((x) => ({ ref: x.ref, day: x.day }));
    if (!items.length) return toast("하나 이상 골라 주세요", true);
    try {
      await api("/api/plan/run", { product: M.info.folder, items, mode: pm });
      S.planUntil = Date.now() + 60000;
      close(); toast(`${items.length}편을 만들기 시작했어요. ‘만든 영상’에서 진행 상황을 볼 수 있어요.`);
      location.hash = "#/jobs";
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- 만든 영상 ---------- */
async function renderJobs() {
  $("#app").innerHTML = `<h1>만든 영상</h1><p class="lead">스튜디오에서 만든 영상과 카드입니다. 파일은 shortform/output 폴더에도 저장돼요.</p><div class="jobs" id="jobs"><div class="loading">불러오는 중…</div></div>`;
  const el = $("#jobs");
  try { S.jobs = await api("/api/jobs"); }
  catch (e) { el.innerHTML = `<div class="empty panel">목록을 불러오지 못했어요: ${esc(e.message)} <button class="btn small" onclick="renderJobs()">다시 시도</button></div>`; return; }
  if (!S.jobs.length) { el.innerHTML = `<div class="empty panel">아직 만든 영상이 없어요. <a href="#/">레퍼런스</a>에서 시작해 보세요.</div>`; return; }
  el.innerHTML = S.jobs.map((j) => {
    const r = j.result || {};
    const th = r.type === "video" ? `<video src="${r.file}#t=1" preload="metadata" muted></video>` : r.type === "cards" ? `<img src="${r.files[0]}" alt="">` : esc({ queued: "대기", running: "만드는 중", drafting: "문구 쓰는 중", error: "실패" }[j.status] || "");
    const st = { queued: "대기 중", running: "만드는 중", drafting: "문구 쓰는 중", done: "완성", error: "실패" }[j.status];
    const bad = (j.fidelity || []).filter((x) => x.score !== null && x.score < 7).length;
    return `<div class="panel job">
      <div class="thumb">${th}</div>
      <div>
        <div>${j.plan_day ? `<span class="tag tname">${esc(j.plan_day)}요일</span> ` : ""}<b>${esc(j.product)}</b> · ${esc(j.template_name)} <span class="status ${j.status}">${st}</span>${bad ? ` <span class="tag" style="background:var(--red-soft);color:var(--red)">실물 점검 ${bad}건</span>` : ""}${(j.lint || []).length ? ` <span class="tag" style="background:var(--red-soft);color:var(--red)">문구 점검 ${j.lint.length}건</span>` : ""}</div>
        <div class="muted">${esc(j.created)} · ${j.mode === "photo" ? "사진만" : "AI 장면"}${j.ref ? ` · 레퍼런스: ${esc((refOf(j.ref) || {}).title || j.ref)}` : ""}</div>
        ${j.error ? `<div class="muted" style="color:var(--red)">${esc(j.error)}</div>` : ""}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        ${r.type === "video" ? `<a class="btn small" href="${r.file}" target="_blank">보기</a><a class="btn small" href="${r.file}" download>저장</a>` : ""}
        ${r.type === "cards" ? `<a class="btn small" href="${r.files[0]}" target="_blank">카드 보기</a>` : ""}
        ${j.status === "drafting" ? "" : `<button class="btn small" data-again="${esc(j.id)}">열어서 고치기</button>`}
        ${["done", "error"].includes(j.status) ? `<button class="btn small ghost" data-hide="${esc(j.id)}" title="영상 파일은 output 폴더에 남아요">목록에서 빼기</button>` : ""}
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-again]").forEach((b) => b.addEventListener("click", () => again(b.dataset.again)));
  el.querySelectorAll("[data-hide]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/api/jobs/hide", { job: b.dataset.hide }); renderJobs(); refreshBadge(); }
    catch (e) { toast(e.message, true); }
  }));
  // 만드는 중인 영상이 있으면 몇 초마다 새로 고친다
  clearTimeout(S.jobsTimer);
  if (S.jobs.some((j) => ["queued", "running", "drafting"].includes(j.status)) || Date.now() < (S.planUntil || 0))
    S.jobsTimer = setTimeout(() => { if (parseHash().path.startsWith("/jobs")) renderJobs(); }, 4000);
}

async function again(id) {
  const j = S.jobs.find((x) => x.id === id);
  const p = S.boot.products.find((x) => x.folder === j.product);
  const M = freshMake();
  M.tpl = j.template; M.ref = j.ref; M.mode = j.mode; M.job = j.status === "done" ? j.id : null;
  if (p) { M.info = p; M.product = { name: p.name, category: p.category || "", origin: p.origin || "", price: p.price || "", unit: p.unit || "", memo: p.memo || "", photoData: null }; }
  const f = JSON.parse(JSON.stringify(j.fields || {}));
  for (const k of ["music", "voice", "ai_label", "motion"]) if (f[k] !== undefined) { M.opts[k] = f[k]; delete f[k]; }
  // 기획·API로 만든 작업은 리스트 칸이 문장만 들어 있을 수 있어 화면 형식으로 맞춘다
  const t = S.boot.templates[j.template];
  for (const fd of (t && t.fields) || []) {
    if (fd.type === "list" && Array.isArray(f[fd.key])) {
      const srcs = fd.sources || ["photo:1"];
      f[fd.key] = f[fd.key].map((x, i) => (typeof x === "string" ? { text: x, source: srcs[i % srcs.length] } : x));
    }
  }
  M.fields = f;
  M.drafted = true; M.via = "이전 작업";
  S.make = M;
  location.hash = `#/make?tpl=${encodeURIComponent(j.template)}&ref=${encodeURIComponent(j.ref || "")}`;
}

async function refreshBadge() {
  try {
    const jobs = await api("/api/jobs");
    const n = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
    const b = $("#job-badge"); b.hidden = !n; b.textContent = n;
  } catch (e) { /* 무시 */ }
}

/* ---------- 시작 ---------- */
async function boot() {
  try {
    S.boot = await api("/api/bootstrap");
  } catch (e) {
    $("#app").innerHTML = `<div class="empty">서버에 연결하지 못했어요: ${esc(e.message)}</div>`;
    return;
  }
  const k = S.boot.keys || {};
  $("#keys").innerHTML = [["fal", "AI 영상"], ["replicate", "AI 예비"], ["openai", "AI 문구"], ["pexels", "무료 풍경 영상"], ["gemini", "Gemini 목소리"]]
    .map(([id, n]) => `<span class="key ${k[id] ? "" : "off"}" title="${k[id] ? "연결됨" : "연결 안 됨 (.env 에 키가 없어요)"}">${n}</span>`).join("");
  if (S.boot.engine === "web") {
    // 웹 엔진: AI 장면·모션 대신 사진만 모드가 기본
    if (S.make) S.make.mode = "photo";
  }
  if (S.boot.notice) {
    const bar = document.createElement("div");
    bar.className = "deploy-notice";
    bar.setAttribute("role", "status");
    bar.textContent = S.boot.notice;
    $("#app")?.prepend(bar);
  }
  window.addEventListener("hashchange", route);
  route();
  refreshBadge();
}
boot();
