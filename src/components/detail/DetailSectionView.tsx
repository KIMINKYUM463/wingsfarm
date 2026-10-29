/* eslint-disable @next/next/no-img-element -- data URL 사진을 그대로 그리고 html-to-image로 캡처하기 위해 img 사용 */
import { Fragment, type CSSProperties, type ReactNode, type Ref } from "react";
import { PLACEHOLDER, resolveImageSrc, type DetailItem, type DetailSection, type DetailTheme, type SectionBg } from "@/lib/detailPage";

const themeVars = (t: DetailTheme) =>
  ({ "--dp-primary": t.primary, "--dp-accent": t.accent, "--dp-tint": t.tint, "--dp-dark": t.dark, "--dp-ink": t.ink }) as CSSProperties;

/** Tailwind는 완성된 클래스 문자열만 인식하므로 배경별 클래스를 미리 적어 둔다 */
const TONE: Record<SectionBg, { root: string; sub: string; eyebrow: string; card: string; line: string; divide: string; num: string }> = {
  light: {
    root: "bg-white text-(--dp-ink)",
    sub: "text-(--dp-ink)/70",
    eyebrow: "text-(--dp-primary)",
    card: "bg-(--dp-tint)",
    line: "border-(--dp-ink)/10",
    divide: "divide-(--dp-ink)/10",
    num: "bg-(--dp-primary) text-white",
  },
  tint: {
    root: "bg-(--dp-tint) text-(--dp-ink)",
    sub: "text-(--dp-ink)/70",
    eyebrow: "text-(--dp-primary)",
    card: "bg-white",
    line: "border-(--dp-ink)/10",
    divide: "divide-(--dp-ink)/10",
    num: "bg-(--dp-primary) text-white",
  },
  dark: {
    root: "bg-(--dp-dark) text-white",
    sub: "text-white/75",
    eyebrow: "text-(--dp-accent)",
    card: "bg-white/10",
    line: "border-white/15",
    divide: "divide-white/15",
    num: "bg-(--dp-accent) text-(--dp-dark)",
  },
};
type Tone = (typeof TONE)[SectionBg];

/** 편집 화면에서만 "[입력 필요]"를 노란색으로 강조 */
function Txt({ text, mark }: { text: string; mark: boolean }) {
  if (!mark || !text.includes(PLACEHOLDER)) return <>{text}</>;
  const parts = text.split(PLACEHOLDER);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <mark className="rounded bg-yellow-200 px-1 text-stone-900">{PLACEHOLDER}</mark>}
        </Fragment>
      ))}
    </>
  );
}

const num = (i: number) => String(i + 1).padStart(2, "0");

function Items({ section, tone, t }: { section: DetailSection; tone: Tone; t: (s: string) => ReactNode }) {
  const items = section.items.filter((i) => i.title || i.text);
  if (!items.length) return null;
  const sub = (i: DetailItem) => i.text && <p className={`mt-2 text-[21px] leading-[1.6] whitespace-pre-line ${tone.sub}`}>{t(i.text)}</p>;

  switch (section.type) {
    case "summary":
      return (
        <div className="mt-14 grid grid-cols-2 gap-5 text-left">
          {items.map((item, i) => (
            <div key={i} className={`rounded-[28px] p-8 ${tone.card}`}>
              <span className={`grid size-[52px] place-items-center rounded-full text-[20px] font-black ${tone.num}`}>{num(i)}</span>
              <p className="mt-5 text-[27px] leading-snug font-bold">{t(item.title)}</p>
              {sub(item)}
            </div>
          ))}
        </div>
      );
    case "process":
      return (
        <div className="mt-14 text-left">
          {items.map((item, i) => (
            <div key={i} className="flex gap-7">
              <div className="flex flex-col items-center">
                <span className={`grid size-[60px] shrink-0 place-items-center rounded-full text-[19px] font-black ${tone.num}`}>{num(i)}</span>
                {i < items.length - 1 && <span className={`w-0 flex-1 border-l-2 border-dashed ${tone.line}`} />}
              </div>
              <div className="pb-12 pt-2.5">
                <p className="text-[27px] font-bold">{t(item.title)}</p>
                {sub(item)}
              </div>
            </div>
          ))}
        </div>
      );
    case "recommend":
      return (
        <div className="mt-14 space-y-4 text-left">
          {items.map((item, i) => (
            <div key={i} className={`flex items-start gap-5 rounded-3xl px-8 py-7 ${tone.card}`}>
              <span className={`grid size-[44px] shrink-0 place-items-center rounded-full text-[22px] font-black ${tone.num}`}>✓</span>
              <div>
                <p className="text-[26px] font-bold">{t(item.title)}</p>
                {sub(item)}
              </div>
            </div>
          ))}
        </div>
      );
    case "guide":
      return (
        <div className="mt-14 grid gap-4 text-left">
          {items.map((item, i) => (
            <div key={i} className={`rounded-3xl px-9 py-8 ${tone.card}`}>
              <p className={`text-[17px] font-black tracking-[0.2em] ${tone.eyebrow}`}>TIP {num(i)}</p>
              <p className="mt-2 text-[26px] font-bold">{t(item.title)}</p>
              {sub(item)}
            </div>
          ))}
        </div>
      );
    case "faq":
      return (
        <div className={`mt-14 divide-y border-y text-left ${tone.line} ${tone.divide}`}>
          {items.map((item, i) => (
            <div key={i} className="py-8">
              <p className="text-[25px] font-bold">
                <span className={`mr-3 font-black ${tone.eyebrow}`}>Q.</span>
                {t(item.title)}
              </p>
              <p className={`mt-3 text-[21px] leading-[1.6] whitespace-pre-line ${tone.sub}`}>
                <span className="mr-3 font-black">A.</span>
                {t(item.text)}
              </p>
            </div>
          ))}
        </div>
      );
    case "spec":
      return (
        <div className="mt-14 border-t-[3px] border-current text-left">
          {items.map((item, i) => (
            <div key={i} className={`grid grid-cols-[220px_1fr] border-b ${tone.line}`}>
              <p className={`px-7 py-6 text-[21px] font-bold ${tone.card}`}>{t(item.title)}</p>
              <p className="px-7 py-6 text-[21px] leading-[1.6] whitespace-pre-line">{t(item.text)}</p>
            </div>
          ))}
        </div>
      );
    case "notice":
      return (
        <div className="mt-10 space-y-6 text-left">
          {items.map((item, i) => (
            <div key={i}>
              <p className="text-[21px] font-bold">· {t(item.title)}</p>
              {item.text && <p className={`mt-1 pl-4 text-[19px] leading-[1.6] whitespace-pre-line ${tone.sub}`}>{t(item.text)}</p>}
            </div>
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {items.map((item, i) => (
            <span key={i} className={`rounded-full px-6 py-3 text-[20px] font-bold ${tone.card}`}>
              {t([item.title, item.text].filter(Boolean).join(" · "))}
            </span>
          ))}
        </div>
      );
    default:
      return (
        <ul className="mx-auto mt-10 max-w-[640px] space-y-4 text-left">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[22px] leading-[1.6]">
              <span className={`font-black ${tone.eyebrow}`}>✓</span>
              <span>
                {item.title && <b>{t(item.title)}</b>}
                {item.title && item.text && " — "}
                {item.text && <span className={tone.sub}>{t(item.text)}</span>}
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

interface Props {
  section: DetailSection;
  theme: DetailTheme;
  productImages: string[];
  company: string;
  markPlaceholders?: boolean;
  ref?: Ref<HTMLElement>;
}

/** 상세페이지 섹션 1개 — 폭 860px 고정 (스마트스토어 권장 폭) */
export function DetailSectionView({ section, theme, productImages, company, markPlaceholders = false, ref }: Props) {
  const img = resolveImageSrc(section.image, productImages);
  const t = (text: string) => <Txt text={text} mark={markPlaceholders} />;

  if (section.type === "hero") {
    return (
      <section ref={ref} style={themeVars(theme)} className="relative h-[1100px] w-[860px] overflow-hidden bg-(--dp-dark) text-white">
        {img ? (
          <img src={img} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--dp-primary),transparent_60%),radial-gradient(circle_at_80%_70%,var(--dp-accent),transparent_55%)] opacity-70" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-black/5 to-black/80" />
        {company && <p className="absolute left-14 top-14 rounded-full bg-white/90 px-6 py-2.5 text-[19px] font-bold text-(--dp-ink)">{company}</p>}
        <div className="absolute inset-x-14 bottom-20">
          {section.eyebrow && (
            <p className="inline-block rounded-full bg-(--dp-accent) px-5 py-2 text-[19px] font-black text-(--dp-dark)">{t(section.eyebrow)}</p>
          )}
          <h2 className="mt-6 text-[66px] leading-[1.2] font-black tracking-tight whitespace-pre-line drop-shadow-lg">{t(section.headline)}</h2>
          {section.body && <p className="mt-6 text-[25px] leading-[1.65] whitespace-pre-line text-white/85">{t(section.body)}</p>}
        </div>
      </section>
    );
  }

  const tone = TONE[section.bg];
  return (
    <section ref={ref} style={themeVars(theme)} className={`w-[860px] px-16 py-24 text-center ${tone.root}`}>
      {section.eyebrow && <p className={`text-[19px] font-black tracking-[0.25em] uppercase ${tone.eyebrow}`}>{t(section.eyebrow)}</p>}
      {section.headline && (
        <h2 className={`mt-4 leading-[1.3] font-black tracking-tight whitespace-pre-line ${section.type === "notice" ? "text-[34px]" : "text-[46px]"}`}>
          {t(section.headline)}
        </h2>
      )}
      {section.body && <p className={`mx-auto mt-6 max-w-[680px] text-[23px] leading-[1.75] whitespace-pre-line ${tone.sub}`}>{t(section.body)}</p>}
      {img && <img src={img} alt="" className="mt-14 aspect-[3/2] w-full rounded-[28px] object-cover" />}
      <Items section={section} tone={tone} t={t} />
    </section>
  );
}
