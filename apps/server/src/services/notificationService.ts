import { prisma } from '../lib/prisma'

interface PushPayload {
  to: string
  title: string
  body: string
  data?: Record<string, any>
}

async function sendExpoPush(notifications: PushPayload[]) {
  if (notifications.length === 0) return

  const chunks: PushPayload[][] = []
  for (let i = 0; i < notifications.length; i += 100) {
    chunks.push(notifications.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      })
    } catch (err) {
      console.error('푸시 알림 전송 실패:', err)
    }
  }
}

// 마감 임박 알림 (매일 오전 9시 실행)
export async function sendDeadlineReminders() {
  const today = new Date()
  const threeDays = new Date(today.getTime() + 3 * 86400000)
  const sevenDays = new Date(today.getTime() + 7 * 86400000)

  const upcomingPrograms = await prisma.welfareProgram.findMany({
    where: {
      isActive: true,
      applyEndDate: {
        gte: today,
        lte: sevenDays,
      },
    },
  })

  if (upcomingPrograms.length === 0) return

  const programIds = upcomingPrograms.map(p => p.id)

  const matches = await prisma.welfareMatch.findMany({
    where: {
      programId: { in: programIds },
      isHidden: false,
      status: { in: ['ELIGIBLE', 'LIKELY'] },
    },
    include: {
      user: { include: { profile: true } },
      program: true,
    },
  })

  const notifications: PushPayload[] = []

  for (const match of matches) {
    const pushToken = match.user.profile?.pushToken
    if (!pushToken) continue

    const daysLeft = Math.floor(
      (new Date(match.program.applyEndDate!).getTime() - today.getTime()) / 86400000
    )

    let title = ''
    let body = ''

    if (daysLeft <= 1) {
      title = `🚨 내일 마감! ${match.program.name}`
      body = `신청 마감이 내일입니다. 지금 바로 신청하세요.`
    } else if (daysLeft <= 3) {
      title = `⏰ D-${daysLeft} ${match.program.name}`
      body = `${daysLeft}일 후 마감됩니다. 서류를 확인하세요.`
    } else {
      title = `📋 D-7 신청 안내: ${match.program.name}`
      body = `7일 후 마감입니다. 미리 준비하세요.`
    }

    notifications.push({
      to: pushToken,
      title,
      body,
      data: { programId: match.programId, type: 'DEADLINE' },
    })

    // 리마인더 기록
    await prisma.reminder.create({
      data: {
        applicationId: match.application?.id ?? '',
        type: `D-${daysLeft}`,
      },
    }).catch(() => {}) // application 없을 경우 스킵
  }

  await sendExpoPush(notifications)
  console.log(`📨 ${notifications.length}개 마감 알림 발송`)
}

// 자립수당 종결 예정 알림 (매월 1일 실행)
export async function sendJaripEndingAlerts() {
  const threeMonthsLater = new Date()
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)

  const profiles = await prisma.youthProfile.findMany({
    where: {
      receivingJaripSudang: true,
      jaripSudangEndDate: {
        lte: threeMonthsLater,
        gte: new Date(),
      },
      pushToken: { not: null },
    },
    include: { user: true },
  })

  const notifications: PushPayload[] = []

  for (const profile of profiles) {
    const endDate = profile.jaripSudangEndDate!
    const monthsLeft = Math.floor(
      (endDate.getTime() - Date.now()) / (30 * 86400000)
    )

    notifications.push({
      to: profile.pushToken!,
      title: `⚠️ 자립수당 종결 ${monthsLeft}개월 전`,
      body: `자립수당이 ${endDate.toLocaleDateString('ko-KR')}에 종결됩니다. 전환 가능한 지원을 확인하세요.`,
      data: { type: 'JARIP_ENDING', monthsLeft },
    })
  }

  await sendExpoPush(notifications)

  // 재매칭 트리거 (종결 후 지원 매칭)
  const { runMatching } = await import('./matchingService')
  for (const profile of profiles) {
    await runMatching(profile.userId)
  }

  console.log(`📨 ${notifications.length}개 자립수당 종결 예정 알림 발송`)
}

// 연락 단절 감지 (매일 오전 8시 실행)
export async function detectDisconnectedYouth() {
  const cutoff = new Date(Date.now() - 14 * 86400000) // 14일 이상 미접속

  const disconnected = await prisma.user.findMany({
    where: {
      role: 'YOUTH',
      lastActiveAt: { lt: cutoff },
      isAtRisk: false,
    },
    include: { profile: true },
  })

  if (disconnected.length === 0) return

  // isAtRisk 플래그 설정
  await prisma.user.updateMany({
    where: { id: { in: disconnected.map(u => u.id) } },
    data: { isAtRisk: true },
  })

  // 전담인력 관리 화면에 표시될 알림 생성 (실제 구현에서는 기관 알림 테이블에 저장)
  console.log(`🔴 연락 단절 감지: ${disconnected.length}명`)
  console.log(disconnected.map(u => `- ${u.name} (${u.profile?.regionSi})`).join('\n'))

  // 청년 본인에게 부드러운 체크인 메시지 발송
  const notifications: PushPayload[] = disconnected
    .filter(u => u.profile?.pushToken)
    .map(u => ({
      to: u.profile!.pushToken!,
      title: '나와가 안부를 전합니다 🌿',
      body: '잘 지내고 계신가요? 받을 수 있는 지원이 업데이트됐어요.',
      data: { type: 'CHECKIN' },
    }))

  await sendExpoPush(notifications)
}

// 상황 체크인 알림 (2주마다 실행)
export async function sendSituationCheckReminder() {
  const profiles = await prisma.youthProfile.findMany({
    where: {
      notifySituationCheck: true,
      pushToken: { not: null },
    },
  })

  const notifications: PushPayload[] = profiles.map(p => ({
    to: p.pushToken!,
    title: '상황이 바뀌었나요?',
    body: '이사·휴학·퇴사 등 변화가 있으면 알려주세요. 새로 받을 수 있는 지원을 찾아드려요.',
    data: { type: 'SITUATION_CHECK' },
  }))

  await sendExpoPush(notifications)
  console.log(`📨 ${notifications.length}개 상황 체크인 알림 발송`)
}
