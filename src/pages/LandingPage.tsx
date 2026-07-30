import { Link } from "react-router";
import { ArrowRight, BookOpenCheck, Clock3, QrCode, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useApi } from "@/hooks/useApi";
import { apiBooks } from "@/api";
import { BookCover } from "@/components/BookCover";

export default function LandingPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const { data: books } = useApi(() => apiBooks.list(), []);
  const marquee = (books ?? []).slice(0, 10);

  const STEPS = [
    { icon: BookOpenCheck, k: "01 · REQUEST", title: "Find it. Request it.", body: "Search the catalog and file a borrow request in one click — or fill your cart and request several books at once." },
    { icon: Clock3, k: "02 · 48-HOUR WINDOW", title: "Approved? Come pick it up.", body: "Approval starts a strict 48-hour pickup window. Miss it and the book automatically goes to the next reader in the queue." },
    { icon: ShieldCheck, k: "03 · 14-DAY LOAN", title: "Your loan starts at the desk.", body: "The clock never runs while a book waits on the hold shelf — your 14 days start the moment staff confirm pickup." },
    { icon: QrCode, k: "04 · DIGITAL ID", title: "One card, always with you.", body: "Your member card lives on your phone: PDF download, QR scan-in at the desk, live loan status for staff." },
  ];

  return (
    <div className="space-y-0">
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-burnt/70 blur-2xl animate-[heroFloat_9s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[22rem] rounded-full bg-brand/50 blur-2xl animate-[heroFloat_11s_ease-in-out_infinite_reverse]" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 md:py-32 lg:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-brand animate-[fadeUp_0.7s_ease-out_both]">
            {t("landing.kicker")}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-7xl animate-[fadeUp_0.7s_ease-out_0.15s_both]">
            {t("landing.title1")}<br />
            <span className="text-brand">{t("landing.title2")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 animate-[fadeUp_0.7s_ease-out_0.3s_both]">
            {t("landing.sub")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-[fadeUp_0.7s_ease-out_0.45s_both]">
            {me ? (
              <Link to="/catalog" className="inline-flex items-center gap-2.5 rounded-sm bg-brand px-7 py-3.5 text-base font-bold text-ink transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-white">
                {t("landing.cta.catalog")} <ArrowRight className="size-5 rtl:rotate-180" />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="inline-flex items-center gap-2.5 rounded-sm bg-brand px-7 py-3.5 text-base font-bold text-ink transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-white">
                  {t("landing.cta.member")} <ArrowRight className="size-5 rtl:rotate-180" />
                </Link>
                <Link to="/login" className="inline-flex items-center rounded-sm border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
                  {t("landing.cta.signin")}
                </Link>
              </>
            )}
          </div>

          <div className="mt-14 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-sm bg-white/15 animate-[fadeUp_0.7s_ease-out_0.6s_both]">
            {[["18+", "titles in the catalog"], ["48h", "pickup window, enforced"], ["14d", "loan period from pickup"]].map(([v, l]) => (
              <div key={l} className="bg-ink/80 px-4 py-4">
                <p className="text-2xl font-bold text-brand tabular-nums">{v}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOOK MARQUEE */}
      <section className="overflow-hidden border-y-2 border-ink bg-burnt py-6">
        <div className="flex w-max gap-4 animate-[marquee_38s_linear_infinite]">
          {[...marquee, ...marquee].map((b, i) => (
            <div key={`${b.id}-${i}`} className="w-28 shrink-0 transition-transform hover:-translate-y-1">
              <BookCover book={b} />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-cream px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-[1440px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-burnt">{t("landing.how")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t("landing.howTitle")}</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <div
                key={s.k}
                className="group rounded-md border border-border bg-white p-5 transition-all hover:-translate-y-1 hover:border-burnt hover:shadow-[6px_6px_0_#C55221]"
                style={{ animation: `fadeUp 0.6s ease-out ${0.1 * i}s both` }}
              >
                <s.icon className="size-7 text-burnt transition-transform group-hover:scale-110" />
                <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-dark">{s.k}</p>
                <h3 className="mt-1 text-lg font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STAFF BAND */}
      <section className="bg-cream-deep px-6 py-16 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-burnt">{t("landing.staffKicker")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{t("landing.staffTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("landing.staffSub")}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              psst — staff entrance is hidden. try the Konami code on the sign-in page: ↑ ↑ ↓ ↓ ← → ← → B A
            </p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2.5 rounded-sm bg-burnt px-7 py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-brand">
            {t("landing.cta.signin")} <ArrowRight className="size-5 rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </div>
  );
}
