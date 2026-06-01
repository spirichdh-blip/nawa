import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('4000'),
  JWT_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ 환경변수 검증 실패:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
