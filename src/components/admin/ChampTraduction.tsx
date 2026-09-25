'use client'

import type { SelectFieldClientComponent } from 'payload'

import { SelectField, useLocale } from '@payloadcms/ui'

import { FRANCAIS } from '@/lib/langues'

/** L'état de traduction n'a de sens que hors français : masqué quand on édite le français. */
export const ChampTraduction: SelectFieldClientComponent = (props) => {
  const locale = useLocale()
  if (locale?.code === FRANCAIS) return null
  return <SelectField {...props} />
}
