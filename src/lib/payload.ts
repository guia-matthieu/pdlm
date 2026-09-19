import config from '@payload-config'
import { getPayload } from 'payload'

/** Client Payload (Local API) — singleton partagé. */
export const getPayloadClient = () => getPayload({ config })
