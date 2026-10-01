import type { CollectionBeforeValidateHook, CollectionConfig, Where } from 'payload'

import { ValidationError } from 'payload'

import { creerPublication, lirePublic, majPublication, supprimerContenu } from '../access'
import { idDe } from '../access/roles'
import { figerTenant, validerRelationsTenant } from '../hooks'
import { validerUrlEditoriale } from '../lib/url'
import { verifierCommuneCreation } from '../hooks/verifierCommuneCreation'
import { ROLES_PUBLICATION } from '../access/roles'

/** XOR page/url : exactement une des deux (I9). */
const validerXor = (
  valeur: unknown,
  siblingData: Record<string, unknown> | undefined,
  champAutre: string,
): true | string => {
  const autreRempli =
    siblingData?.[champAutre] !== undefined &&
    siblingData?.[champAutre] !== null &&
    siblingData?.[champAutre] !== ''
  const ceRempli = valeur !== undefined && valeur !== null && valeur !== ''
  if (ceRempli && autreRempli) return 'Renseigner soit une page, soit une URL — pas les deux.'
  if (!ceRempli && !autreRempli) return 'Renseigner une page ou une URL.'
  return true
}

/** I4 : pages référencées par les items (1 sous-niveau). */
const extraireRefsMenus = (data: Record<string, unknown>) => {
  const pages: Array<string | number> = []
  const parcourir = (items: unknown) => {
    if (!Array.isArray(items)) return
    for (const item of items as Array<Record<string, unknown>>) {
      if (item?.['page']) pages.push(item['page'] as string | number)
      if (Array.isArray(item?.['enfants'])) parcourir(item['enfants'])
    }
  }
  parcourir(data['items'])
  return { pages }
}

/** Une seule entrée de menus par commune (I9 — garantie forte en base par index unique sur tenant). */
const unSeulMenuParCommune: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const tenant = idDe((data as Record<string, unknown>)['tenant'] ?? originalDoc?.tenant)
  if (tenant === undefined) return data
  const conditions: Where[] = [{ tenant: { equals: tenant } }]
  if (originalDoc?.id) conditions.push({ id: { not_equals: originalDoc.id } })
  const existants = await req.payload.count({
    collection: 'menus',
    where: { and: conditions },
  })
  if (existants.totalDocs > 0) {
    throw new ValidationError({
      errors: [{ message: 'Cette commune possède déjà un menu.', path: 'nom' }],
    })
  }
  return data
}

/** Validateurs typés pour les champs page/url des items de menu (XOR + schéma). */
type OptsValidation = { siblingData?: Record<string, unknown> }

const validerPageMenu = (v: unknown, opts?: OptsValidation): true | string =>
  validerXor(v, opts?.siblingData, 'url')

const validerUrlMenu = (v: unknown, opts?: OptsValidation): true | string => {
  const xor = validerXor(v, opts?.siblingData, 'page')
  if (xor !== true) return xor
  return validerUrlEditoriale(v as string | null | undefined)
}

export const Menus: CollectionConfig = {
  slug: 'menus',
  labels: { singular: 'Menu', plural: 'Menus' },
  admin: {
    useAsTitle: 'nom',
  },
  access: {
    read: lirePublic,
    create: creerPublication,
    update: majPublication,
    delete: supprimerContenu,
  },
  hooks: {
    beforeValidate: [unSeulMenuParCommune],
    beforeChange: [
      verifierCommuneCreation(...ROLES_PUBLICATION),
      figerTenant,
      validerRelationsTenant(extraireRefsMenus),
    ],
  },
  fields: [
    { name: 'nom', type: 'text', required: true, defaultValue: 'Principal', label: 'Nom' },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'Éléments',
      labels: { singular: 'Élément', plural: 'Éléments' },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Libellé' },
        {
          name: 'page',
          type: 'relationship',
          relationTo: 'pages',
          label: 'Page',
          validate: validerPageMenu,
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
          validate: validerUrlMenu,
        },
        {
          name: 'enfants',
          type: 'array',
          label: 'Sous-éléments (1 niveau)',
          labels: { singular: 'Sous-élément', plural: 'Sous-éléments' },
          admin: { description: 'Un seul niveau d’imbrication.' },
          fields: [
            { name: 'label', type: 'text', required: true, label: 'Libellé' },
            {
              name: 'page',
              type: 'relationship',
              relationTo: 'pages',
              label: 'Page',
              validate: validerPageMenu,
            },
            {
              name: 'url',
              type: 'text',
              label: 'URL',
              validate: validerUrlMenu,
            },
          ],
        },
      ],
    },
  ],
}
