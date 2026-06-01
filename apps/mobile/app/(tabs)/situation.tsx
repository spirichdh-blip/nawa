import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { welfareApi } from '@/lib/api/welfare'

// VC/심사위원 피드백 반영:
// "상황 변동 입력이 너무 복잡하면 아무도 안 씀"
// → 카드형 선택지로 단순화, 변동 있는 것만 체크

const SITUATION_ITEMS = [
  {
    key: 'moved',
    emoji: '📦',
    title: '이사했어요',
    desc: '거주 지역이 바뀌었어요',
    fields: ['regionSi', 'regionGu'],
  },
  {
    key: 'schoolChange',
    emoji: '🎓',
    title: '학적이 변경됐어요',
    desc: '휴학·복학·졸업·입학',
    fields: ['isStudent', 'status'],
  },
  {
    key: 'jobChange',
    emoji: '💼',
    title: '취업 상황이 달라졌어요',
    desc: '취업·퇴사·구직 시작',
    fields: ['isEmployed', 'status'],
  },
  {
    key: 'jaripEnded',
    emoji: '📅',
    title: '자립수당이 종결됐어요',
    desc: '60개월 만료 또는 중도 종결',
    fields: ['receivingJaripSudang'],
  },
  {
    key: 'basicLiving',
    emoji: '🛡️',
    title: '기초생활수급 자격이 달라졌어요',
    desc: '수급 신청·취소·변동',
    fields: ['receivingBasicLiving'],
  },
  {
    key: 'incomeChange',
    emoji: '💰',
    title: '소득이 크게 달라졌어요',
    desc: '월 소득 변동 50만 원 이상',
    fields: ['monthlyIncome'],
  },
]

const REGION_SI = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

export default function SituationScreen() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, any>>({})

  const update = useMutation({
    mutationFn: (changes: Record<string, any>) =>
      welfareApi.updateSituation(changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      Alert.alert(
        '업데이트 완료 🌿',
        '바뀐 상황에 맞는 지원을 다시 찾아봤어요. 홈 화면에서 확인해보세요!',
        [{ text: '확인' }]
      )
      setSelected(new Set())
      setDetails({})
    },
    onError: () => {
      Alert.alert('실패', '잠시 후 다시 시도해주세요.')
    },
  })

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSubmit = () => {
    if (selected.size === 0) {
      Alert.alert('바뀐 상황을 선택해주세요')
      return
    }

    const changes: Record<string, any> = {}

    if (selected.has('moved') && details.regionSi) {
      changes.regionSi = details.regionSi
      if (details.regionGu) changes.regionGu = details.regionGu
    }
    if (selected.has('schoolChange')) {
      changes.isStudent = details.isStudent ?? false
      changes.status = details.isStudent ? 'STUDENT' : 'JOB_SEEKING'
    }
    if (selected.has('jobChange')) {
      changes.isEmployed = details.isEmployed ?? false
      changes.status = details.isEmployed ? 'EMPLOYED' : 'JOB_SEEKING'
    }
    if (selected.has('jaripEnded')) {
      changes.receivingJaripSudang = false
    }
    if (selected.has('basicLiving')) {
      changes.receivingBasicLiving = details.receivingBasicLiving ?? false
    }
    if (selected.has('incomeChange') && details.monthlyIncome !== undefined) {
      changes.monthlyIncome = details.monthlyIncome
    }

    update.mutate(changes)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>상황 업데이트</Text>
        <Text style={styles.subtitle}>
          바뀐 것이 있으면 알려주세요.{'\n'}맞는 지원을 다시 찾아드려요.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SITUATION_ITEMS.map(item => (
          <View key={item.key}>
            <TouchableOpacity
              style={[
                styles.card,
                selected.has(item.key) && styles.cardSelected,
              ]}
              onPress={() => toggle(item.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              <View
                style={[
                  styles.check,
                  selected.has(item.key) && styles.checkSelected,
                ]}
              >
                {selected.has(item.key) && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* 세부 입력 (선택된 경우) */}
            {selected.has(item.key) && item.key === 'moved' && (
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>새 거주지 시/도</Text>
                <View style={styles.chips}>
                  {REGION_SI.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.chip,
                        details.regionSi === r && styles.chipSelected,
                      ]}
                      onPress={() => setDetails(d => ({ ...d, regionSi: r }))}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          details.regionSi === r && styles.chipTextSelected,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selected.has(item.key) && item.key === 'schoolChange' && (
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>현재 상태</Text>
                <View style={styles.chips}>
                  <TouchableOpacity
                    style={[styles.chip, details.isStudent === true && styles.chipSelected]}
                    onPress={() => setDetails(d => ({ ...d, isStudent: true }))}
                  >
                    <Text style={[styles.chipText, details.isStudent === true && styles.chipTextSelected]}>
                      재학 중 / 복학
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, details.isStudent === false && styles.chipSelected]}
                    onPress={() => setDetails(d => ({ ...d, isStudent: false }))}
                  >
                    <Text style={[styles.chipText, details.isStudent === false && styles.chipTextSelected]}>
                      휴학 / 졸업
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selected.has(item.key) && item.key === 'jobChange' && (
              <View style={styles.detail}>
                <Text style={styles.detailLabel}>현재 상태</Text>
                <View style={styles.chips}>
                  <TouchableOpacity
                    style={[styles.chip, details.isEmployed === true && styles.chipSelected]}
                    onPress={() => setDetails(d => ({ ...d, isEmployed: true }))}
                  >
                    <Text style={[styles.chipText, details.isEmployed === true && styles.chipTextSelected]}>
                      취업했어요
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, details.isEmployed === false && styles.chipSelected]}
                    onPress={() => setDetails(d => ({ ...d, isEmployed: false }))}
                  >
                    <Text style={[styles.chipText, details.isEmployed === false && styles.chipTextSelected]}>
                      퇴사·구직 중
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (selected.size === 0 || update.isPending) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={selected.size === 0 || update.isPending}
        >
          <Text style={styles.submitBtnText}>
            {update.isPending ? '업데이트 중...' : '지원 다시 찾기'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.noChangeText}>
          바뀐 것이 없어요? 현재 자격 그대로 유지됩니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginTop: 4 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  cardSelected: {
    borderColor: '#2D9B6F',
    backgroundColor: '#F0F9F4',
  },
  cardEmoji: { fontSize: 26 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: { backgroundColor: '#2D9B6F', borderColor: '#2D9B6F' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detail: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginTop: -6,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: 10,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#2D9B6F', borderColor: '#2D9B6F' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#2D9B6F',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  noChangeText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 4 },
})
