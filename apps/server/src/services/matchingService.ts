import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { MatchStatus, WelfareCategory } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

interface UserContext {
  userId: string
  age: number
  regionSi: string
  regionGu: string
  protectionType: string
  monthsSinceProtectionEnd: number
  status: string
  isStudent: boolean
  isEmployed: boolean
  monthlyIncome: number
  receivingJaripSudang: boolean
  jaripSudangMonthsLeft?: number
  receivingBasicLiving: boolean
  receivingHousing: boolean
  hasNaeIlCheokChuk: boolean
}

interface MatchResult {
  programId: string
  status: MatchStatus
  reasons: string[]
  priority: number
}

// 규칙 기반 1차 필터링 (빠르고 정확)
function ruleBasedFilter(program: any, ctx: UserContext): MatchResult | null {
  const reasons: string[] = []
  let eligible = true
  const el = program.eligibility as any

  // 나이 조건
  if (el.minAge && ctx.age < el.minAge) {
    return null // 완전 불가
  }
  if (el.maxAge && ctx.age > el.maxAge) {
    return null
  }

  // 지역 조건
  if (program.regionRestrict?.length > 0) {
    const inRegion = program.regionRestrict.some(
      (r: string) => ctx.regionSi.includes(r) || ctx.regionGu.includes(r)
    )
    if (!inRegion) return null
  }

  // 보호종료 후 경과 기간
  if (el.protectionEndedWithin && ctx.monthsSinceProtectionEnd > el.protectionEndedWithin) {
    return null
  }

  // 자립수당 종결 후 전환 지원 여부
  if (program.isPostJarip && ctx.receivingJaripSudang) {
    // 자립수당 수급 중이면 종결 후 지원은 '예정' 상태로
    reasons.push('자립수당 종결 후 신청 가능')
    if (ctx.jaripSudangMonthsLeft !== undefined && ctx.jaripSudangMonthsLeft <= 3) {
      reasons.push(`⚠️ 자립수당 종결 ${ctx.jaripSudangMonthsLeft}개월 전 — 미리 준비하세요`)
      return { programId: program.id, status: MatchStatus.LIKELY, reasons, priority: 95 }
    }
    return { programId: program.id, status: MatchStatus.LIKELY, reasons, priority: 60 }
  }

  // 학생 조건
  if (program.tags?.includes('대학') && !ctx.isStudent) {
    return null
  }

  // 비재학 상태에서만 가능한 지원
  if (program.tags?.includes('미취업') && ctx.isEmployed) {
    return null
  }

  // 기초생활 중복 수급 방지
  if (program.category === 'BASIC_LIVELIHOOD' && ctx.receivingBasicLiving) {
    return null
  }

  let priority = 50

  // 마감 임박 우선순위
  if (program.applyEndDate) {
    const daysLeft = Math.floor(
      (new Date(program.applyEndDate).getTime() - Date.now()) / 86400000
    )
    if (daysLeft < 0) return null // 마감 지남
    if (daysLeft <= 7) priority += 40
    else if (daysLeft <= 14) priority += 20
    else if (daysLeft <= 30) priority += 10
  }

  // 상시 지원 우선순위
  if (program.isYearRound) {
    reasons.push('상시 신청 가능')
    priority += 10
  }

  // 고액 지원 우선순위
  if (program.benefitLumpsum && program.benefitLumpsum >= 500) priority += 15
  if (program.benefitMonthly && program.benefitMonthly >= 40) priority += 15

  reasons.push('자격 조건 충족')

  return {
    programId: program.id,
    status: MatchStatus.ELIGIBLE,
    reasons,
    priority,
  }
}

// AI 2차 검증 (불확실한 케이스 처리)
async function aiVerify(programs: any[], ctx: UserContext): Promise<Record<string, string[]>> {
  const programSummaries = programs
    .map(p => `[${p.id}] ${p.name}: ${JSON.stringify(p.eligibility)}`)
    .join('\n')

  const userSummary = `
- 나이: ${ctx.age}세
- 거주지: ${ctx.regionSi} ${ctx.regionGu}
- 보호종료 후: ${ctx.monthsSinceProtectionEnd}개월
- 보호 유형: ${ctx.protectionType}
- 현황: ${ctx.status} / 학생여부: ${ctx.isStudent} / 근로여부: ${ctx.isEmployed}
- 월소득: ${ctx.monthlyIncome}만원
- 자립수당 수급: ${ctx.receivingJaripSudang}
- 기초생활수급: ${ctx.receivingBasicLiving}
`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `당신은 자립준비청년 복지 자격 판단 전문가입니다.
주어진 복지 프로그램 자격 조건과 청년의 상황을 비교하여 자격 여부를 판단하세요.
반드시 주어진 데이터에만 근거하여 판단하고, 불확실한 경우 "확인필요"라고 답하세요.
각 프로그램 ID별로 JSON 형식으로 응답하세요: { "프로그램ID": ["판단이유1", "판단이유2"] }`,
    messages: [
      {
        role: 'user',
        content: `청년 상황:\n${userSummary}\n\n검토할 프로그램:\n${programSummaries}`,
      },
    ],
  })

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {}

  return {}
}

export async function runMatching(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  })

  if (!user?.profile) return

  const profile = user.profile
  const now = new Date()

  const monthsSinceEnd = Math.floor(
    (now.getTime() - profile.protectionEndDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  )

  const age = Math.floor(
    (now.getTime() - profile.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  )

  let jaripMonthsLeft: number | undefined
  if (profile.receivingJaripSudang && profile.jaripSudangStartDate) {
    const elapsed = Math.floor(
      (now.getTime() - profile.jaripSudangStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    jaripMonthsLeft = Math.max(0, 60 - elapsed)
  }

  const ctx: UserContext = {
    userId,
    age,
    regionSi: profile.regionSi,
    regionGu: profile.regionGu,
    protectionType: profile.protectionType,
    monthsSinceProtectionEnd: monthsSinceEnd,
    status: profile.status,
    isStudent: profile.isStudent,
    isEmployed: profile.isEmployed,
    monthlyIncome: profile.monthlyIncome,
    receivingJaripSudang: profile.receivingJaripSudang,
    jaripSudangMonthsLeft: jaripMonthsLeft,
    receivingBasicLiving: profile.receivingBasicLiving,
    receivingHousing: profile.receivingHousing,
    hasNaeIlCheokChuk: profile.hasNaeIlCheokChuk,
  }

  const allPrograms = await prisma.welfareProgram.findMany({
    where: { isActive: true },
  })

  const ruleResults: MatchResult[] = []
  const needsAiCheck: any[] = []

  for (const program of allPrograms) {
    const result = ruleBasedFilter(program, ctx)
    if (result) {
      if (result.status === MatchStatus.LIKELY) {
        needsAiCheck.push(program)
        ruleResults.push(result)
      } else {
        ruleResults.push(result)
      }
    }
  }

  // AI 보완 검증
  let aiReasons: Record<string, string[]> = {}
  if (needsAiCheck.length > 0) {
    aiReasons = await aiVerify(needsAiCheck, ctx)
  }

  // DB에 매칭 결과 저장
  for (const result of ruleResults) {
    const extraReasons = aiReasons[result.programId] ?? []
    await prisma.welfareMatch.upsert({
      where: { userId_programId: { userId, programId: result.programId } },
      update: {
        status: result.status,
        reasons: [...result.reasons, ...extraReasons],
        priority: result.priority,
        matchedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId,
        programId: result.programId,
        status: result.status,
        reasons: [...result.reasons, ...extraReasons],
        priority: result.priority,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }
}

// AI 신청서·자기소개서 초안 생성
export async function generateApplicationDraft(
  userId: string,
  programId: string
): Promise<string> {
  const [user, program] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    prisma.welfareProgram.findUnique({ where: { id: programId } }),
  ])

  if (!user?.profile || !program) throw new Error('데이터를 찾을 수 없습니다.')

  const profile = user.profile

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `당신은 자립준비청년의 복지 신청서 작성을 돕는 전문가입니다.
청년의 상황에 맞는 진솔하고 구체적인 신청서 초안을 작성하세요.
과장하거나 사실과 다른 내용을 넣지 마세요.
청년이 직접 수정할 수 있도록 [수정 필요] 표시를 적절히 포함하세요.`,
    messages: [
      {
        role: 'user',
        content: `다음 정보를 바탕으로 "${program.name}" 신청서 초안을 작성해주세요.

신청자 정보:
- 이름: ${user.name}
- 나이: ${Math.floor((Date.now() - profile.birthDate.getTime()) / (365 * 24 * 60 * 60 * 1000))}세
- 거주지: ${profile.regionSi} ${profile.regionGu}
- 보호종료 시점: ${profile.protectionEndDate.toLocaleDateString('ko-KR')}
- 현재 상황: ${profile.status === 'STUDENT' ? '재학 중' : profile.status === 'EMPLOYED' ? '근로 중' : '구직 중'}
- 지원 사유: [청년이 직접 작성할 부분]

지원 사업: ${program.name}
지원 내용: ${program.description}

자기소개서와 신청 사유를 포함한 초안을 작성해주세요.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

// 상황 변동 후 재매칭
export async function handleSituationChange(
  userId: string,
  changes: Record<string, any>
): Promise<void> {
  await prisma.situationLog.create({
    data: {
      userId,
      changes: Object.entries(changes).map(([field, value]) => ({
        field,
        newValue: value,
      })),
      triggeredRematch: true,
    },
  })

  // 기존 매칭 만료 처리
  await prisma.welfareMatch.updateMany({
    where: { userId, isHidden: false },
    data: { expiresAt: new Date() },
  })

  // 재매칭 실행
  await runMatching(userId)
}
