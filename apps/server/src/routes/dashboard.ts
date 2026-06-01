import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireCaseWorker } from '../middlewares/auth'

const router = Router()

// 전담기관 대시보드 메인 — 이 화면이 B2G 판매 포인트
router.get('/overview', requireAuth, requireCaseWorker, async (req: Request, res: Response) => {
  const caseWorker = await prisma.caseWorker.findUnique({
    where: { userId: req.user!.userId },
    include: { organization: true },
  })

  if (!caseWorker) return res.status(404).json({ error: '전담인력 정보를 찾을 수 없습니다.' })

  const region = caseWorker.assignedRegion ?? caseWorker.organization.region

  // 담당 지역 청년 현황
  const [
    totalYouth,
    atRiskYouth,
    pendingApplications,
    recentSituationChanges,
    topMissedPrograms,
  ] = await Promise.all([
    // 전체 담당 청년 수
    prisma.user.count({
      where: {
        role: 'YOUTH',
        profile: { regionSi: { contains: region } },
      },
    }),

    // 연락 단절 위험 청년
    prisma.user.findMany({
      where: {
        role: 'YOUTH',
        isAtRisk: true,
        profile: { regionSi: { contains: region } },
      },
      include: { profile: true },
      orderBy: { lastActiveAt: 'asc' },
    }),

    // 신청 미완료 현황 (마감 임박)
    prisma.application.findMany({
      where: {
        status: { in: ['SAVED', 'DOC_PREPARING'] },
        program: {
          applyEndDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 86400000),
          },
        },
        user: {
          profile: { regionSi: { contains: region } },
        },
      },
      include: { program: true, user: { select: { name: true, id: true } } },
      orderBy: { program: { applyEndDate: 'asc' } },
      take: 20,
    }),

    // 최근 7일 상황 변동 청년
    prisma.situationLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        user: {
          profile: { regionSi: { contains: region } },
        },
      },
      include: { user: { select: { name: true, id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 가장 많이 놓치는 지원 (신청 안 된 ELIGIBLE 매칭)
    prisma.welfareMatch.groupBy({
      by: ['programId'],
      where: {
        status: 'ELIGIBLE',
        application: null,
        user: {
          profile: { regionSi: { contains: region } },
        },
      },
      _count: { programId: true },
      orderBy: { _count: { programId: 'desc' } },
      take: 5,
    }),
  ])

  // 놓치는 지원 이름 조회
  const missedProgramIds = topMissedPrograms.map(m => m.programId)
  const missedPrograms = await prisma.welfareProgram.findMany({
    where: { id: { in: missedProgramIds } },
    select: { id: true, name: true, category: true },
  })

  const missedWithCount = topMissedPrograms.map(m => ({
    count: m._count.programId,
    program: missedPrograms.find(p => p.id === m.programId),
  }))

  return res.json({
    organization: caseWorker.organization.name,
    region,
    stats: {
      totalYouth,
      atRiskCount: atRiskYouth.length,
      urgentApplications: pendingApplications.length,
      recentChanges: recentSituationChanges.length,
    },
    atRiskYouth: atRiskYouth.map(u => ({
      id: u.id,
      name: u.name,
      lastActiveAt: u.lastActiveAt,
      daysSinceActive: Math.floor((Date.now() - u.lastActiveAt.getTime()) / 86400000),
      region: `${u.profile?.regionSi} ${u.profile?.regionGu}`,
    })),
    urgentApplications: pendingApplications,
    recentSituationChanges: recentSituationChanges.map(log => ({
      userId: log.userId,
      userName: log.user.name,
      changes: log.changes,
      changedAt: log.createdAt,
    })),
    topMissedPrograms: missedWithCount,
  })
})

// 특정 청년 상세 (전담인력용)
router.get('/youth/:id', requireAuth, requireCaseWorker, async (req: Request, res: Response) => {
  const youth = await prisma.user.findUnique({
    where: { id: req.params.id, role: 'YOUTH' },
    include: {
      profile: true,
      matches: {
        include: { program: true, application: true },
        orderBy: { priority: 'desc' },
      },
      applications: {
        include: { program: true },
        orderBy: { updatedAt: 'desc' },
      },
      situationLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    omit: { passwordHash: true },
  })

  if (!youth) return res.status(404).json({ error: '청년 정보를 찾을 수 없습니다.' })

  const eligible = youth.matches.filter(m => m.status === 'ELIGIBLE').length
  const applied = youth.applications.filter(a => a.status === 'SUBMITTED').length
  const receiving = youth.applications.filter(a => a.status === 'RECEIVING').length

  return res.json({
    ...youth,
    summary: {
      eligibleCount: eligible,
      appliedCount: applied,
      receivingCount: receiving,
      applicationRate: eligible > 0 ? Math.round((applied / eligible) * 100) : 0,
    },
  })
})

// 피드백 목록 (분기별 보고서용)
router.get('/feedbacks', requireAuth, requireCaseWorker, async (req: Request, res: Response) => {
  const feedbacks = await prisma.feedback.findMany({
    where: { isReviewed: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      category: true,
      content: true,
      isAnonymous: true,
      createdAt: true,
      // 익명이 아닌 경우에도 이름만 표시
      user: { select: { name: true } },
    },
  })

  return res.json(feedbacks)
})

export default router
