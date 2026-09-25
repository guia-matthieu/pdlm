import { cheminLangue } from '@/lib/adresses'
import type { ContexteLangue } from '@/lib/langue-courante'
import { langueDe } from '@/lib/langues'

/** Sélecteur de langue (spec § 4) : liens simples, sans JavaScript ; seulement si 2 langues ou plus. */
export function SelecteurLangue({ ctx }: { ctx: ContexteLangue }) {
  if (ctx.languesSite.length < 2) return null
  return (
    <nav aria-label={ctx.t.selecteurLangue} className="selecteur-langue">
      <ul>
        {ctx.languesSite.map((code) => (
          <li key={code}>
            <a
              href={cheminLangue(ctx.chemin, code, ctx.site.langueRacine)}
              lang={code}
              hrefLang={code}
              aria-current={code === ctx.langue ? 'true' : undefined}
            >
              {langueDe(code).nomNatif}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
