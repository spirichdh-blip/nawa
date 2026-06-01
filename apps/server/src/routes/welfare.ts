import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middlewares/auth'
import {
  runMatching,
  generateApplicationDraft,
  handleSituationChange,
} from '../services/matchingService'

const router = Router()

// 내 매칭 지원 목록 (홈 화면 핵심)
router.get('/matches', requireAuth, async (req: Request, res: Response) => {
  const { category, status } = req.query

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { lastActiveAt: new Date(), isAtRisk: false },
  })

  const matches = await prisma.welfareMatch.findMany({
    where: {
      userId: req.user!.userId,
      isHidden: false,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      program: true,
      application: true,
    },
    orderBy: [{ priority: 'desc' }, { matchedAt: 'desc' }],
  })

  // 카테고리 필터
  const filtered = category
    ? matches.filter(m => m.program.category === category)
    : matches

  // 마감 D-day 계산 추가
  const enriched = filtered.map(m => {
    const daysLeft = m.program.applyEndDate
      ? Math.floor(
          (new Date(m.program.applyEndDate).getTime() - Date.now()) / 86400000
        )
      : null

    return {
      ...m,
      daysLeft,
      isUrgent: daysLeft !== null && daysLeft <= 7,
    }
  })

  return res.json({
    total: enriched.length,
    eligible: enriched.filter(m => m.status === 'ELIGIBLE').length,
    urgent: enriched.filter(m => m.isUrgent).length,
    items: enriched,
  })
})

// 매칭 재실행 (상황 변동 후)
router.post('/rematch', requireAuth, async (req: Request, res: Response) => {
  await runMatching(req.user!.userId)
  return res.json({ message: '매칭이 업데이트됐습니다.' })
})

// 상황 변동 입력
const situationSchema = z.object({
  changes: z.record(z.any()),
})

router.post('/situation', requireAuth, async (req: Request, res: Response) => {
  const parsed = situationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  // 프로필 업데이트
  const allowed = [
    'regionSi', 'regionGu', 'status', 'isStudent', 'isEmployed',
    'monthlyIncome', 'receivingJaripSudang', 'receivingBasicLiving',
    'receivingHousing', 'schoolName',
  ]
  const safeChanges: Record<string, any> = {}
  for (const key of allowed) {
    if (key in parsed.data.changes) {
      safeChanges[key] = parsed.data.changes[key]
    }
  }

  if (Object.keys(safeChanges).length > 0) {
    await prisma.youthProfile.update({
      where: { userId: req.user!.userId },
      data: safeChanges,
    })
  }

  await handleSituationChange(req.user!.userId, safeChanges)

  return res.json({ message: '상황이 반영됐습니다. 지원 목록을 다시 확인해보세요.' })
})

// 지원 프로그램 상세
router.get('/programs/:id', requireAuth, async (req: Request, res: Response) => {
  const program = await prisma.welfareProgram.findUnique({
    where: { id: req.params.id },
  })

  if (!program) return res.status(404).json({ error: '프로그램을 찾을 수 없습니다.' })

  return res.json(program)
})

// 신청 저장 / 상태 업데이트
router.post('/applications', requireAuth, async (req: Request, res: Response) => {
  const { programId, matchId } = req.body

  const program = await prisma.welfareProgram.findUnique({
    where: { id: programId },
  })
  if (!program) return res.status(404).json({ error: '프로그램을 찾을 수 없습니다.' })

  const docChecklist = program.requiredDocs.map((doc: string) => ({
    name: doc,
    done: false,
    guide: getDocGuide(doc),
  }))

  const application = await prisma.application.upsert({
    where: { matchId: matchId ?? '' },
    update: {},
    create: {
      userId: req.user!.userId,
      programId,
      matchId: matchId ?? undefined,
      docChecklist,
    },
  })

  return res.status(201).json(application)
})

router.patch('/applications/:id', requireAuth, async (req: Request, res: Response) => {
  const { status, docChecklist, notes } = req.body

  const app = await prisma.application.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  })
  if (!app) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' })

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(status && { status }),
      ...(docChecklist && { docChecklist }),
      ...(notes && { notes }),
      ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
    },
  })

  return res.json(updated)
})

// AI 신청서 초안 생성
router.post('/applications/:id/draft', requireAuth, async (req: Request, res: Response) => {
  const app = await prisma.application.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  })
  if (!app) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' })

  const draft = await generateApplicationDraft(req.user!.userId, app.programId)

  await prisma.application.update({
    where: { id: app.id },
    data: { draftContent: draft },
  })

  return res.json({
    draft,
    disclaimer:
      '⚠️ AI가 초안을 생성했습니다. 반드시 내용을 확인하고 수정하세요. 최종 확인은 거주지 자립지원전담기관에 문의하세요.',
  })
})

// 내 신청 목록
router.get('/applications', requireAuth, async (req: Request, res: Response) => {
  const apps = await prisma.application.findMany({
    where: { userId: req.user!.userId },
    include: { program: true },
    orderBy: { updatedAt: 'desc' },
  })

  return res.json(apps)
})

// 숨기기
router.post('/matches/:id/hide', requireAuth, async (req: Request, res: Response) => {
  await prisma.welfareMatch.update({
    where: { id: req.params.id },
    data: { isHidden: true },
  })
  return res.json({ message: '숨김 처리됐습니다.' })
})

function getDocGuide(docName: string): string {
  const guides: Record<string, string> = {
    '주민등록등본': '정부24(www.gov.kr)에서 무료 발급 가능 / 주민센터 방문 발급',
    '보호종료확인서': '보호종료 시설 또는 자립지원전담기관에 요청',
    '통장사본': '본인 명의 통장 첫 페이지 사진/스캔',
    '재학증명서': '재학 중인 학교 학생처 발급 / 대학은 학생포털에서 온라인 발급',
    '신분증 사본': '주민등록증 또는 운전면허증 앞면',
    '소득 증빙서류': '근로소득원천징수영수증 또는 사업소득확인서 / 홈택스 발급',
    '임대차계약서': '현재 거주하는 집의 전세·월세 계약서 사본',
    '진료비 영수증': '병원에서 발급받은 진료비 영수증',
    '재직증명서': '재직 중인 직장에서 발급',
  }

  return guides[docName] ?? '담당 기관에 문의하세요.'
}

export default router
