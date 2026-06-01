import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { welfareApi, Application } from '@/lib/api/welfare'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  SAVED:         { label: '저장됨', color: '#6B7280', bg: '#F3F4F6' },
  DOC_PREPARING: { label: '서류 준비 중', color: '#D97706', bg: '#FFFBEB' },
  READY:         { label: '신청 준비 완료', color: '#2D9B6F', bg: '#F0F9F4' },
  SUBMITTED:     { label: '신청 완료', color: '#1D4ED8', bg: '#EFF6FF' },
  UNDER_REVIEW:  { label: '심사 중', color: '#7C3AED', bg: '#F5F3FF' },
  APPROVED:      { label: '승인', color: '#059669', bg: '#ECFDF5' },
  REJECTED:      { label: '반려', color: '#DC2626', bg: '#FEF2F2' },
  RECEIVING:     { label: '수급 중 🎉', color: '#059669', bg: '#ECFDF5' },
  ENDED:         { label: '종료', color: '#6B7280', bg: '#F3F4F6' },
}

export default function ApplicationsScreen() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: apps, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => welfareApi.getApplications().then(r => r.data),
  })

  const updateApp = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      welfareApi.updateApplication(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })

  const generateDraft = useMutation({
    mutationFn: (appId: string) => welfareApi.generateDraft(appId),
    onSuccess: (res, appId) => {
      Alert.alert(
        '신청서 초안 완성',
        `${res.data.disclaimer}\n\n${res.data.draft.slice(0, 200)}...`,
        [{ text: '확인' }]
      )
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2D9B6F" style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>신청 관리</Text>
        <Text style={styles.subtitle}>
          {apps?.filter(a => a.status === 'SUBMITTED' || a.status === 'RECEIVING').length ?? 0}개 신청 완료
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {!apps || apps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>저장된 신청이 없어요</Text>
            <Text style={styles.emptyText}>
              홈에서 지원을 선택하면 여기서 관리할 수 있어요
            </Text>
          </View>
        ) : (
          apps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              expanded={expandedId === app.id}
              onToggle={() => setExpandedId(id => id === app.id ? null : app.id)}
              onUpdateStatus={(status) => updateApp.mutate({ id: app.id, data: { status } })}
              onUpdateDoc={(checklist) => updateApp.mutate({ id: app.id, data: { docChecklist: checklist } })}
              onGenerateDraft={() => generateDraft.mutate(app.id)}
              isDraftLoading={generateDraft.isPending && generateDraft.variables === app.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function AppCard({
  app,
  expanded,
  onToggle,
  onUpdateStatus,
  onUpdateDoc,
  onGenerateDraft,
  isDraftLoading,
}: {
  app: any
  expanded: boolean
  onToggle: () => void
  onUpdateStatus: (s: string) => void
  onUpdateDoc: (c: any[]) => void
  onGenerateDraft: () => void
  isDraftLoading: boolean
}) {
  const st = STATUS_LABEL[app.status] ?? STATUS_LABEL.SAVED
  const checklist: { name: string; done: boolean; guide: string }[] = app.docChecklist ?? []
  const doneCount = checklist.filter(d => d.done).length
  const progress = checklist.length > 0 ? doneCount / checklist.length : 0

  const toggleDoc = (idx: number) => {
    const updated = checklist.map((d, i) =>
      i === idx ? { ...d, done: !d.done } : d
    )
    onUpdateDoc(updated)
    if (updated.every(d => d.done) && app.status === 'DOC_PREPARING') {
      onUpdateStatus('READY')
    } else if (!updated.every(d => d.done) && app.status === 'READY') {
      onUpdateStatus('DOC_PREPARING')
    }
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.8}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.programName}>{app.program?.name ?? '지원 프로그램'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* 서류 진행률 바 */}
      {checklist.length > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{doneCount}/{checklist.length}</Text>
        </View>
      )}

      {expanded && (
        <View style={styles.cardBody}>
          {/* 서류 체크리스트 */}
          {checklist.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>서류 체크리스트</Text>
              {checklist.map((doc, i) => (
                <View key={i} style={styles.docItem}>
                  <TouchableOpacity
                    style={[styles.checkbox, doc.done && styles.checkboxDone]}
                    onPress={() => toggleDoc(i)}
                  >
                    {doc.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docName, doc.done && styles.docNameDone]}>
                      {doc.name}
                    </Text>
                    <Text style={styles.docGuide}>{doc.guide}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* AI 초안 생성 */}
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={onGenerateDraft}
            disabled={isDraftLoading}
          >
            {isDraftLoading ? (
              <ActivityIndicator size="small" color="#2D9B6F" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#2D9B6F" />
                <Text style={styles.draftBtnText}>AI 신청서 초안 생성</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 신청처 바로가기 */}
          {app.program?.applyUrl && (
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => Linking.openURL(app.program.applyUrl)}
            >
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.applyBtnText}>신청하러 가기</Text>
            </TouchableOpacity>
          )}

          {/* 신청 완료 체크 */}
          {app.status !== 'SUBMITTED' && app.status !== 'RECEIVING' && (
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => onUpdateStatus('SUBMITTED')}
            >
              <Text style={styles.submitBtnText}>✅ 신청 완료했어요</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardHeaderLeft: { flex: 1, gap: 6 },
  programName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#2D9B6F',
    borderRadius: 2,
  },
  progressText: { fontSize: 12, color: '#6B7280', minWidth: 28 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  docItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxDone: { backgroundColor: '#2D9B6F', borderColor: '#2D9B6F' },
  docName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  docNameDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  docGuide: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D9B6F',
  },
  draftBtnText: { color: '#2D9B6F', fontWeight: '700', fontSize: 14 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2D9B6F',
    borderRadius: 12,
    padding: 14,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  submitBtn: {
    backgroundColor: '#F0F9F4',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#1A6B4A', fontWeight: '600', fontSize: 14 },
  empty: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 8,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
})
