import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middlewares/auth'

const router = Router()

const feedbackSchema = z.object({
  category: z.enum(['제도개선', '서비스불편', '새지원제안', '기타']),
  content: z.string().min(10).max(1000),
  isAnonymous: z.boolean().default(false),
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const feedback = await prisma.feedback.create({
    data: {
      ...parsed.data,
      userId: req.user!.userId,
    },
  })

  return res.status(201).json({ message: '소중한 의견 감사합니다. 분기별 보고서에 반영됩니다.' })
})

export default router
