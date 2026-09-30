import Image from "next/image";
import { Sparkles, ShieldCheck } from "lucide-react";
import { configured } from "@/lib/supabase";
import LoginForm from "@/components/login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-scene">
      <header className="login-brand">
        <span className="brand-mark">
          <Sparkles size={23} />
        </span>
        <b>PocaPop Vault</b>
        <span className="edition-label">CATALOG STUDIO</span>
      </header>
      <div className="login-gallery" aria-hidden="true">
        <div className="gallery-word">
          POCA
          <br />
          POP.
        </div>
        <div className="gallery-deck">
          {Array.from({ length: 6 }, (_, i) => (
            <div className={"gallery-card g" + i} key={i}>
              <Image
                src={"/brand/photocard-" + (i + 1) + ".png"}
                alt=""
                width={286}
                height={420}
                priority={i < 3}
              />
              <span>
                {["ROYAL", "SILK", "ROYAL", "CROWN", "CROWN", "ROYAL"][i]}
                <Sparkles size={12} />
              </span>
            </div>
          ))}
        </div>
        <div className="gallery-caption">
          <span>THE POCA COLLECTION</span>
          <b>Moonlit Hanbok / HB01</b>
        </div>
      </div>
      <section className="login-entry">
        <span className="eyebrow">
          <ShieldCheck size={15} /> Moderator access
        </span>
        <h1>PocaPop Vault</h1>
        <h2>Sign in</h2>
        {configured() ? (
          <LoginForm error={error} />
        ) : (
          <p className="notice error">Supabase is not configured.</p>
        )}
        <footer>
          <span>Private workspace</span>
          <span>PocaPop / 2026</span>
        </footer>
      </section>
    </main>
  );
}
