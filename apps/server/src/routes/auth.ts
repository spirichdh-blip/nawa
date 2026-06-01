import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signToken, requireAuth } from '../middlewares/auth'
import { runMatching } from '../services/matchingService'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(2).max(20),
  phone: z.string().regex(/^010-?\d{4}-?\d{4}$/),
  password: z.string().min(8),
  // 온보딩 핵심 5가지만 (VC 피드백: 마찰 최소화)
  birthDate: z.string().datetime(),
  regionSi: z.string(),
  regionGu: z.string().optional().default(''),
  protectionEndDate: z.string().datetime(),
  protectionType: z.enum([
    'CHILD_CARE_FACILITY',
    'GROUP_HOME',
    'FOSTER_CARE',
    'YOUTH_SHELTER',
    'OTHER',
  ]),
})

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const data = parsed.data

  const exists = await prisma.user.findUnique({ where: { phone: data.phone } })
  if (exists) return res.status(409).json({ error: '이미 가입된 전화번호입니다.' })

  const passwordHash = await bcrypt.hash(data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: `${data.phone.replace(/-/g, '')}@nawa.app`,
      passwordHash,
      profile: {
        create: {
          birthDate: new Date(data.birthDate),
          regionSi: data.regionSi,
          regionGu: data.regionGu,
          protectionEndDate: new Date(data.protectionEndDate),
          protectionType: data.protectionType,
        },
      },
    },
  })

  // 첫 매칭 실행 (비동기 — 응답을 막지 않음)
  runMatching(user.id).catch(console.error)

  const token = signToken({ userId: user.id, role: user.role })
  return res.status(201).json({ token, userId: user.id })
})

const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: '입력값 오류' })

  const { phone, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user) return res.status(401).json({ error: '전화번호 또는 비밀번호가 틀렸습니다.' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: '전화번호 또는 비밀번호가 틀렸습니다.' })

  // 마지막 접속 시간 갱신 (연락 단절 감지용)
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date(), isAtRisk: false },
  })

  const token = signToken({ userId: user.id, role: user.role })
  return res.json({ token, userId: user.id, role: user.role })
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { profile: true },
    omit: { passwordHash: true },
  })

  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date(), isAtRisk: false },
  })

  return res.json(user)
})

export default router
