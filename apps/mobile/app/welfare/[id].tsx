import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { welfareApi } from '@/lib/api/welfare'

export default function WelfareDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: program, isLoading } = useQuery({
    queryKey: ['program', id],
    queryFn: () => welfareApi.getProgram(id).then(r => r.data),
  })

  const createApp = useMutation({
    mutationFn: () => welfareApi.createApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications', 'matches'] })
      Alert.alert(
        '신청 준비 시작 ✅',
        '신청 관리 탭에서 서류 체크리스트를 확인해보세요.',
        [
          { text: '바로 확인', onPress: () => router.push('/(tabs)/applications') },
          { text: '닫기' },
        ]
      )
    },
  })

  if (isLoading || !program) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2D9B6F" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const deadline = program.applyEndDate
    ? new Date(program.applyEndDate)
    : null
  const daysLeft = deadline
    ? Math.floor((deadline.getTime() - Date.now()) / 86400000)
    : null

  const eligibility = program.eligibility as any
  const conditions: string[] = eligibility?.conditions ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 닫기 버튼 */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color="#374151" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{program.source}</Text>
        </View>
        <Text style={styles.title}>{program.name}</Text>
        <Text style={styles.operator}>{program.operator}</Text>
        <Text style={styles.description}>{program.description}</Text>

        {/* 마감 경고 */}
        {daysLeft !== null && daysLeft <= 7 && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentText}>
              🚨 신청 마감 D-{daysLeft} — 지금 바로 준비하세요
            </Text>
          </View>
        )}

        {/* 지원 내용 */}
        <Section title="💰 지원 내용">
          {program.benefitAmount && (
            <InfoRow label="지원 금액" value={program.benefitAmount} />
          )}
          {program.benefitDuration && (
            <InfoRow label="지원 기간" value={program.benefitDuration} />
          )}
          {deadline ? (
            <InfoRow label="신청 마감" value={deadline.toLocaleDateString('ko-KR')} />
          ) : program.isYearRound ? (
            <InfoRow label="신청 기간" value="상시 신청 가능" />
          ) : null}
        </Section>

        {/* 자격 조건 */}
        <Section title="✅ 자격 조건">
          {conditions.map((c, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}
        </Section>

        {/* 필요 서류 */}
        {program.requiredDocs.length > 0 && (
          <Section title="📋 필요 서류">
            {program.requiredDocs.map((doc: string, i: number) => (
              <View key={i} style={styles.docRow}>
                <Ionicons name="document-text-outline" size={16} color="#2D9B6F" />
                <Text style={styles.docText}>{doc}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* 주의사항 */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>⚠️ 확인 필요</Text>
          <Text style={styles.disclaimerText}>
            자격 조건은 지자체와 연도에 따라 달라질 수 있습니다.
            최종 확인은 거주지 자립지원전담기관에서 받으세요.
            자립지원전담기관 연락처: 자립정보ON (jaripjungbo.or.kr)
          </Text>
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        {program.applyUrl && (
          <TouchableOpacity
            style={styles.applyLink}
            onPress={() => Linking.openURL(program.applyUrl!)}
          >
            <Ionicons name="open-outline" size={18} color="#2D9B6F" />
            <Text style={styles.applyLinkText}>신청 페이지 바로가기</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => createApp.mutate()}
          disabled={createApp.isPending}
        >
          <Text style={styles.saveBtnText}>
            {createApp.isPending ? '저장 중...' : '신청 준비 시작'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9F4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1A6B4A' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  operator: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 8 },
  urgentBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
  },
  urgentText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionBody: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 14, color: '#6B7280', flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#2D9B6F', fontWeight: '700', fontSize: 14 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docText: { fontSize: 14, color: '#374151' },
  disclaimer: {
    marginTop: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  disclaimerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  disclaimerText: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  footer: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  applyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D9B6F',
  },
  applyLinkText: { color: '#2D9B6F', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    backgroundColor: '#2D9B6F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
