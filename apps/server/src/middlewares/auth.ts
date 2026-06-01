import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../lib/env'

export interface AuthPayload {
  userId: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' })
  }

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' })
  }
}

export function requireCaseWorker(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'CASE_WORKER' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '전담인력 권한이 필요합니다.' })
  }
  next()
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' })
}
