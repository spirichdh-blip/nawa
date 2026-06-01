import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'
import { env } from './lib/env'
import authRouter from './routes/auth'
import welfareRouter from './routes/welfare'
import dashboardRouter from './routes/dashboard'
import feedbackRouter from './routes/feedback'
import profileRouter from './routes/profile'
import {
  sendDeadlineReminders,
  sendJaripEndingAlerts,
  detectDisconnectedYouth,
  sendSituationCheckReminder,
} from './services/notificationService'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGINS.split(',') }))
app.use(express.json())

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  })
)

// 라우트
app.use('/api/auth', authRouter)
app.use('/api/welfare', welfareRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/feedback', feedbackRouter)
app.use('/api/profile', profileRouter)

// 헬스체크
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// 스케줄러 (cron)
if (env.NODE_ENV === 'production') {
  // 매일 오전 9시 — 마감 임박 알림
  cron.schedule('0 9 * * *', () => {
    sendDeadlineReminders().catch(console.error)
  }, { timezone: 'Asia/Seoul' })

  // 매월 1일 오전 10시 — 자립수당 종결 예정 알림
  cron.schedule('0 10 1 * *', () => {
    sendJaripEndingAlerts().catch(console.error)
  }, { timezone: 'Asia/Seoul' })

  // 매일 오전 8시 — 연락 단절 감지
  cron.schedule('0 8 * * *', () => {
    detectDisconnectedYouth().catch(console.error)
  }, { timezone: 'Asia/Seoul' })

  // 격주 월요일 오전 10시 — 상황 체크인 요청
  cron.schedule('0 10 * * 1', () => {
    sendSituationCheckReminder().catch(console.error)
  }, { timezone: 'Asia/Seoul' })
}

const PORT = Number(env.PORT)
app.listen(PORT, () => {
  console.log(`🌿 나와(NAWA) 서버 실행 중 — http://localhost:${PORT}`)
})
