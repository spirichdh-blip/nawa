import { api } from './client'

export interface WelfareMatch {
  id: string
  programId: string
  status: 'ELIGIBLE' | 'LIKELY' | 'NEEDS_CHECK'
  reasons: string[]
  priority: number
  daysLeft: number | null
  isUrgent: boolean
  program: WelfareProgram
  application?: Application | null
}

export interface WelfareProgram {
  id: string
  name: string
  description: string
  category: string
  source: string
  operator: string
  applyUrl: string | null
  benefitAmount: string | null
  benefitMonthly: number | null
  benefitDuration: string | null
  eligibility: any
  requiredDocs: string[]
  applyEndDate: string | null
  isYearRound: boolean
  tags: string[]
  isPostJarip: boolean
}

export interface Application {
  id: string
  status: string
  docChecklist: { name: string; done: boolean; guide: string }[]
  draftContent: string | null
  notes: string | null
  submittedAt: string | null
}

export const welfareApi = {
  getMatches: (category?: string) =>
    api.get<{
      total: number
      eligible: number
      urgent: number
      items: WelfareMatch[]
    }>('/welfare/matches', { params: { category } }),

  rematch: () => api.post('/welfare/rematch'),

  updateSituation: (changes: Record<string, any>) =>
    api.post('/welfare/situation', { changes }),

  getProgram: (id: string) => api.get<WelfareProgram>(`/welfare/programs/${id}`),

  createApplication: (programId: string, matchId?: string) =>
    api.post<Application>('/welfare/applications', { programId, matchId }),

  updateApplication: (id: string, data: Partial<Application & { status: string }>) =>
    api.patch<Application>(`/welfare/applications/${id}`, data),

  generateDraft: (applicationId: string) =>
    api.post<{ draft: string; disclaimer: string }>(
      `/welfare/applications/${applicationId}/draft`
    ),

  getApplications: () => api.get<Application[]>('/welfare/applications'),

  hideMatch: (matchId: string) => api.post(`/welfare/matches/${matchId}/hide`),
}
