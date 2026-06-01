import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { welfareApi, WelfareMatch } from '@/lib/api/welfare'
import { useAuthStore } from '@/store/authStore'

const CATEGORIES = [
  { value: undefined, label: '전체' },
  { value: 'LIVING_EXPENSE', label: '생활비' },
  { value: 'HOUSING', label: '주거' },
  { value: 'SCHOLARSHIP', label: '장학금' },
  { value: 'EMPLOYMENT', label: '취업' },
  { value: 'ASSET_BUILDING', label: '자산' },
  { value: 'MEDICAL', label: '의료' },
  { value: 'EMERGENCY', label: '긴급' },
]

const CATEGORY_EMOJI: Record<string, string> = {
  LIVING_EXPENSE: '💰',
  HOUSING: '🏠',
  SCHOLARSHIP: '📚',
  EMPLOYMENT: '💼',
  ASSET_BUILDING: '🏦',
  MEDICAL: '🏥',
  EMERGENCY: '🚨',
  BASIC_LIVELIHOOD: '🛡️',
  STARTUP: '🚀',
  PRIVATE: '🤝',
}

export default function HomeScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['matches', selectedCategory],
    queryFn: () => welfareApi.getMatches(selectedCategory).then(r => r.data),
  })

  const rematch = useMutation({
    mutationFn: () => welfareApi.rematch(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  })

  const saveApp = useMutation({
    mutationFn: ({ programId, matchId }: { programId: string; matchId: string }) =>
      welfareApi.createApplication(programId, matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches', 'applications'] }),
  })

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2D9B6F" />
          <Text style={styles.loadingText}>지원을 찾고 있어요...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const urgent = data?.items?.filter(m => m.isUrgent) ?? []
  const regular = data?.items?.filter(m => !m.isUrgent) ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>나와</Text>
          <Text style={styles.headerSub}>
            받을 수 있는 지원 {data?.eligible ?? 0}개를 찾았어요
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => rematch.mutate()}
          disabled={rematch.isPending}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={rematch.isPending ? '#9CA3AF' : '#2D9B6F'}
          />
        </TouchableOpacity>
      </View>

      {/* 카테고리 필터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.label}
            style={[
              styles.categoryBtn,
              selectedCategory === c.value && styles.categoryBtnActive,
            ]}
            onPress={() => setSelectedCategory(c.value)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === c.value && styles.categoryTextActive,
              ]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor="#2D9B6F"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 마감 임박 섹션 */}
        {urgent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🚨 마감 임박</Text>
              <Text style={styles.sectionCount}>{urgent.length}개</Text>
            </View>
            {urgent.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                urgent
                onPress={() => router.push(`/welfare/${m.programId}`)}
                onSave={() => saveApp.mutate({ programId: m.programId, matchId: m.id })}
              />
            ))}
          </View>
        )}

        {/* 전체 지원 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✅ 받을 수 있는 지원</Text>
            <Text style={styles.sectionCount}>{regular.length}개</Text>
          </View>
          {regular.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                선택한 카테고리에 해당하는 지원이 없어요.{'\n'}상황이 바뀌었으면 업데이트해보세요.
              </Text>
            </View>
          ) : (
            regular.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                onPress={() => router.push(`/welfare/${m.programId}`)}
                onSave={() => saveApp.mutate({ programId: m.programId, matchId: m.id })}
              />
            ))
          )}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ 자격 판단은 AI 기반이며 최종 확인은 거주지 자립지원전담기관에서 받으세요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function MatchCard({
  match,
  urgent,
  onPress,
  onSave,
}: {
  match: WelfareMatch
  urgent?: boolean
  onPress: () => void
  onSave: () => void
}) {
  const alreadySaved = !!match.application
  const emoji = CATEGORY_EMOJI[match.program.category] ?? '📋'

  return (
    <TouchableOpacity
      style={[styles.card, urgent && styles.cardUrgent]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.cardIcon, urgent && styles.cardIconUrgent]}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
        </View>
      </View>

      <View style={styles.cardCenter}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {match.program.name}
          </Text>
          {match.status === 'LIKELY' && (
            <View style={styles.likelyBadge}>
              <Text style={styles.likelyText}>확인 필요</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardBenefit} numberOfLines={1}>
          {match.program.benefitAmount ?? match.program.benefitDuration ?? match.program.operator}
        </Text>

        <View style={styles.cardMeta}>
          {match.daysLeft !== null ? (
            <Text style={[styles.cardDeadline, match.daysLeft <= 3 && styles.cardDeadlineRed]}>
              D-{match.daysLeft}
            </Text>
          ) : match.program.isYearRound ? (
            <Text style={styles.cardYearRound}>상시 신청</Text>
          ) : null}
          <Text style={styles.cardOperator}>{match.program.operator}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, alreadySaved && styles.saveBtnDone]}
        onPress={e => {
          e.stopPropagation()
          if (!alreadySaved) onSave()
        }}
      >
        <Ionicons
          name={alreadySaved ? 'checkmark' : 'add'}
          size={20}
          color={alreadySaved ? '#2D9B6F' : '#9CA3AF'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 15 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryBtnActive: { backgroundColor: '#2D9B6F' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  categoryTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sectionCount: { fontSize: 13, color: '#9CA3AF' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  cardLeft: { marginRight: 12 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconUrgent: { backgroundColor: '#FEF2F2' },
  cardEmoji: { fontSize: 22 },
  cardCenter: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  likelyBadge: {
    backgroundColor: '#FEF9C3',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  likelyText: { fontSize: 10, fontWeight: '600', color: '#854D0E' },
  cardBenefit: { fontSize: 13, color: '#6B7280' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardDeadline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardDeadlineRed: { color: '#EF4444', backgroundColor: '#FEF2F2' },
  cardYearRound: {
    fontSize: 12,
    color: '#2D9B6F',
    backgroundColor: '#F0F9F4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  cardOperator: { fontSize: 12, color: '#9CA3AF' },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  saveBtnDone: { backgroundColor: '#F0F9F4' },
  empty: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyText: { color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  disclaimer: {
    backgroundColor: '#FFF9C4',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  disclaimerText: { fontSize: 11, color: '#854D0E', lineHeight: 16 },
})
