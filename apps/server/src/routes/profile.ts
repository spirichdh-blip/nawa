import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middlewares/auth'

const router = Router()

const profileUpdateSchema = z.object({
  regionSi: z.string().optional(),
  regionGu: z.string().optional(),
  status: z.enum(['STUDENT', 'EMPLOYED', 'JOB_SEEKING', 'INACTIVE']).optional(),
  isStudent: z.boolean().optional(),
  isEmployed: z.boolean().optional(),
  monthlyIncome: z.number().min(0).optional(),
  receivingJaripSudang: z.boolean().optional(),
  jaripSudangStartDate: z.string().datetime().optional(),
  receivingBasicLiving: z.boolean().optional(),
  receivingHousing: z.boolean().optional(),
  hasNaeIlCheokChuk: z.boolean().optional(),
  pushToken: z.string().optional(),
  notifyDeadline: z.boolean().optional(),
  notifySituationCheck: z.boolean().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const profile = await prisma.youthProfile.findUnique({
    where: { userId: req.user!.userId },
  })
  if (!profile) return res.status(404).json({ error: '프로필이 없습니다.' })
  return res.json(profile)
})

router.patch('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const updated = await prisma.youthProfile.update({
    where: { userId: req.user!.userId },
    data: {
      ...parsed.data,
      ...(parsed.data.jaripSudangStartDate && {
        jaripSudangStartDate: new Date(parsed.data.jaripSudangStartDate),
      }),
    },
  })

  return res.json(updated)
})

export default router
