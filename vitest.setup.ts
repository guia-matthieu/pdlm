// Any setup scripts you might need go here

// Base de tests dédiée — jamais la base de dev (l'assignation après dotenv gagne)
import 'dotenv/config'

process.env.DATABASE_URI =
  process.env.DATABASE_URI_TEST ?? 'postgres://postgres:postgres@127.0.0.1:5432/pdlm_test'
process.env.S3_ENABLED = 'false'
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? 'test' })
