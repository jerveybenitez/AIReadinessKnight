/**
 * Seed entry point — run with `pnpm seed`.
 * Loads .env first so payload.config.ts sees DATABASE_URL / PAYLOAD_SECRET.
 */
import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../payload.config'
import { seedDefaultMode } from './default-mode'

const payload = await getPayload({ config })
const result = await seedDefaultMode(payload)

console.log(
  result === 'created'
    ? 'Seeded "default" mode from ai_readiness_questions.json'
    : '"default" mode already exists — nothing to do (admin edits are never overwritten)',
)

// Payload keeps the process alive (DB pool); exit explicitly.
process.exit(0)
