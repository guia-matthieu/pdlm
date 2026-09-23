import { isIP } from 'node:net'

import { describe, expect, it } from 'vitest'

import { ipVisiteur, tronquerIp } from '@/lib/mesure/ip'

/**
 * I18 — aucune adresse IP complète ne sort de pdlm vers Umami.
 * Caddy est le seul mandataire : la valeur la plus à droite de
 * X-Forwarded-For est la sienne ; tout ce qui est à gauche vient du client
 * et peut être forgé.
 */
describe('ipVisiteur', () => {
  it('prend la valeur la plus à droite, jamais celle forgée à gauche', () => {
    expect(ipVisiteur('1.2.3.4, 90.84.235.17')).toBe('90.84.235.17')
    expect(ipVisiteur('90.84.235.17')).toBe('90.84.235.17')
    expect(ipVisiteur('8.8.8.8,2a01:cb00:1234:5600::1')).toBe('2a01:cb00:1234:5600::1')
  })

  it('aucune IP sans en-tête, avec une valeur illisible ou une adresse locale', () => {
    expect(ipVisiteur(null)).toBeNull()
    expect(ipVisiteur('')).toBeNull()
    expect(ipVisiteur('1.2.3.4, faux')).toBeNull()
    expect(ipVisiteur('1.2.3.4, 127.0.0.1')).toBeNull()
    expect(ipVisiteur('::1')).toBeNull()
    expect(ipVisiteur('::ffff:10.0.0.3')).toBeNull()
    expect(ipVisiteur('172.18.0.5')).toBeNull()
    expect(ipVisiteur('192.168.1.10')).toBeNull()
    expect(ipVisiteur('fd12:3456::1')).toBeNull()
  })
})

describe('tronquerIp', () => {
  it('IPv4 : dernier octet à zéro', () => {
    expect(tronquerIp('90.84.235.17')).toBe('90.84.235.0')
  })

  it('IPv6 : garde les 48 premiers bits', () => {
    expect(tronquerIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:db8:85a3::')
    const court = tronquerIp('2001:db8::1')
    expect(court).toBe('2001:db8:0::')
    expect(isIP(court ?? '')).toBe(6)
  })

  it('IPv4 encapsulée dans IPv6, notation pointée ou hexadécimale : règle IPv4', () => {
    expect(tronquerIp('::ffff:90.84.235.17')).toBe('90.84.235.0')
    expect(tronquerIp('::ffff:5a54:eb11')).toBe('90.84.235.0')
    expect(ipVisiteur('::ffff:a00:3')).toBeNull() // 10.0.0.3
  })

  it('valeur illisible : rien', () => {
    expect(tronquerIp('pas-une-ip')).toBeNull()
    expect(tronquerIp('')).toBeNull()
    expect(tronquerIp('999.1.1.1')).toBeNull()
  })
})
