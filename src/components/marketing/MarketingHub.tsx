import { BRAND } from "@/lib/brand";
import { MARKETING_FORMAT_META, MARKETING_FORMATS, MARKETING_STAGES, type MarketingFormat, type MarketingStage } from "@/lib/marketingAi";

interface Props {
  product: string;
  setProduct: (v: string) => void;
  inSeason: { name: string }[];
  onPick: (f: MarketingFormat) => void;
}

const STAGES: MarketingStage[] = ["reach", "convert"];

/** 6칸 격자에 한 줄 3장(2칸씩). 3으로 나눠 2장이 남으면 앞의 2장을 3칸씩 넓혀 빈칸 없이 채운다 */
const isWide = (count: number, index: number) => count % 3 === 2 && index < 2;

/** 마케팅 첫 화면: 오늘 홍보할 상품을 정하고 → 용도별 카드에서 형식을 고른다 */
export function MarketingHub({ product, setProduct, inSeason, onPick }: Props) {
  const name = product.trim();
  return (
    <div className="space-y-10">
      <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-8 text-white shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-96 animate-float rounded-full bg-amber-400/10 blur-3xl [animation-delay:-7s]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px]" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">{BRAND} Marketing Studio</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight md:text-4xl">
              상품 하나로,
              <br />
              고객이 보는 모든 곳에
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
              홍보할 상품을 정하고 아래에서 형식을 고르면 스튜디오가 열려요. 만든 결과는 보관함에 자동 저장돼요.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-sm">
            <label htmlFor="marketing-product" className="text-xs font-semibold text-white/50">
              오늘 홍보할 상품
            </label>
            <input
              id="marketing-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="예: 산지직송 청송 부사 사과 5kg"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-white/30 focus:border-amber-300/60 focus:bg-white/15"
            />
            {inSeason.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] text-white/40">이번 달 제철</p>
                <div className="flex flex-wrap gap-1.5">
                  {inSeason.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setProduct(s.name)}
                      className={`rounded-full px-2.5 py-1 text-xs transition ${
                        name === s.name ? "bg-amber-300 font-semibold text-[#07140f]" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {STAGES.map((stage, si) => {
        const formats = MARKETING_FORMATS.filter((f) => MARKETING_FORMAT_META[f].stage === stage);
        return (
          <section key={stage}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700/70">Step {si + 1}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-900">{MARKETING_STAGES[stage].title}</h2>
            <p className="mt-0.5 mb-4 text-sm text-stone-500">{MARKETING_STAGES[stage].description}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {formats.map((f, i) => (
                <FormatCard key={f} format={f} product={name} delay={i * 60} wide={isWide(formats.length, i)} onPick={onPick} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface CardProps {
  format: MarketingFormat;
  product: string;
  delay: number;
  wide: boolean;
  onPick: (f: MarketingFormat) => void;
}

function FormatCard({ format, product, delay, wide, onPick }: CardProps) {
  const meta = MARKETING_FORMAT_META[format];
  return (
    <button
      type="button"
      onClick={() => onPick(format)}
      style={{ animationDelay: `${delay}ms` }}
      className={`${wide ? "lg:col-span-3" : "lg:col-span-2"} group relative flex animate-fade-up flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl focus-visible:outline-2 focus-visible:outline-emerald-500`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${meta.accent}`} />
      <span className={`pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-linear-to-br ${meta.accent} opacity-0 blur-2xl transition duration-500 group-hover:opacity-25`} />

      <span className="relative flex items-start justify-between gap-3">
        <span className={`grid size-12 place-items-center rounded-2xl bg-linear-to-br ${meta.accent} text-2xl shadow-lg transition duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
          <span aria-hidden>{meta.icon}</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">{meta.studio}</span>
      </span>

      <span className="relative mt-4 block text-lg font-bold tracking-tight text-stone-900">{meta.title}</span>
      <span className="relative mt-1 block text-sm leading-relaxed text-stone-500">{meta.blurb}</span>

      <span className="relative mt-4 flex flex-wrap gap-1.5">
        {meta.gets.map((g) => (
          <span key={g} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-600">
            {g}
          </span>
        ))}
      </span>

      <span className="relative mt-auto flex items-center justify-between gap-2 pt-5 text-sm font-semibold text-emerald-700">
        <span className="truncate">{product ? `${product} · 만들기` : "스튜디오 열기"}</span>
        <span className="transition duration-300 group-hover:translate-x-1" aria-hidden>
          →
        </span>
      </span>
    </button>
  );
}
