import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RichText } from '@/components/RichText'
import { cheminLangue } from '@/lib/adresses'

/** Un paragraphe Lexical contenant un seul lien. */
function avecLien(fields: Record<string, unknown>) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: [
            {
              type: 'link',
              version: 3,
              direction: null,
              format: '',
              indent: 0,
              fields,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'lien',
                  format: 0,
                  mode: 'normal',
                  style: '',
                  detail: 0,
                },
              ],
            },
          ],
        },
      ],
    },
  } as never
}

const enCorse = (c: string) => cheminLangue(c, 'co', 'fr')
const rendu = (fields: Record<string, unknown>, lien?: (c: string) => string) =>
  renderToStaticMarkup(createElement(RichText, { data: avecLien(fields), lien }))

describe('liens des textes riches (R9)', () => {
  it('un lien interne saisi à la main reçoit le préfixe de la langue affichée', () => {
    expect(rendu({ linkType: 'custom', url: '/agenda' }, enCorse)).toContain('href="/co/agenda"')
  })

  it('un lien externe reste intact, nouvel onglet conservé', () => {
    const html = rendu(
      { linkType: 'custom', url: 'https://www.service-public.fr', newTab: true },
      enCorse,
    )
    expect(html).toContain('href="https://www.service-public.fr"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('un lien vers une page du CMS devient /<slug> (accueil → /), puis préfixé', () => {
    const page = (slug: string) => ({
      linkType: 'internal',
      doc: { relationTo: 'pages', value: { id: 1, slug } },
    })
    expect(rendu(page('vie-municipale'), enCorse)).toContain('href="/co/vie-municipale"')
    expect(rendu(page('accueil'), enCorse)).toContain('href="/co"')
  })

  it('sans `lien` (français, langue du domaine) : chemin inchangé', () => {
    expect(rendu({ linkType: 'custom', url: '/agenda' })).toContain('href="/agenda"')
  })

  it('un lien à schéma dangereux est neutralisé en « # »', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>x</script>', '//evil.com']) {
      const html = rendu({ linkType: 'custom', url }, enCorse)
      expect(html, url).toContain('href="#"')
      expect(html, url).not.toContain('javascript:')
      expect(html, url).not.toContain('data:')
    }
  })

  it('une ancre de la page reste intacte', () => {
    expect(rendu({ linkType: 'custom', url: '#horaires' }, enCorse)).toContain('href="#horaires"')
  })
})
