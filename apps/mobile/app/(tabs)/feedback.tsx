import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/lib/api/client'

const CATEGORIES = [
  { value: '제도개선', emoji: '📢', desc: '복지 제도가 이렇게 바뀌면 좋겠어요' },
  { value: '서비스불편', emoji: '🔧', desc: '앱 사용 중 불편했던 점이 있어요' },
  { value: '새지원제안', emoji: '💡', desc: '아직 없는 지원 정보를 추가해주세요' },
  { value: '기타', emoji: '💬', desc: '하고 싶은 말이 있어요' },
]

export default function FeedbackScreen() {
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!category || content.trim().length < 10) {
      Alert.alert('내용을 10자 이상 입력해주세요')
      return
    }

    setLoading(true)
    try {
      await api.post('/feedback', { category, content, isAnonymous })
      Alert.alert(
        '제안 접수 완료 💚',
        '소중한 의견 감사합니다.\n아동권리보장원 분기 보고서에 반영됩니다.',
        [{ text: '확인' }]
      )
      setCategory('')
      setContent('')
    } catch {
      Alert.alert('실패', '잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>자립준비청년이{'\n'}제안합니다</Text>
        <Text style={styles.subtitle}>
          당신의 경험이 제도를 바꿀 수 있어요.{'\n'}
          의견은 비식별 처리 후 분기별 보고서로 전달됩니다.
        </Text>

        <Text style={styles.sectionLabel}>어떤 내용인가요?</Text>
        <View style={styles.categories}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.catCard, category === c.value && styles.catCardSelected]}
              onPress={() => setCategory(c.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.catEmoji}>{c.emoji}</Text>
              <Text style={[styles.catValue, category === c.value && styles.catValueSelected]}>
                {c.value}
              </Text>
              <Text style={styles.catDesc}>{c.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>내용을 입력해주세요</Text>
        <TextInput
          style={styles.textarea}
          value={content}
          onChangeText={setContent}
          placeholder="자유롭게 적어주세요. 최소 10자 이상"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{content.length}자</Text>

        <View style={styles.anonymousRow}>
          <View>
            <Text style={styles.anonymousLabel}>익명으로 제출</Text>
            <Text style={styles.anonymousDesc}>이름 없이 내용만 전달됩니다</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: '#D1D5DB', true: '#2D9B6F' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!category || content.length < 10 || loading) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!category || content.length < 10 || loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? '전달 중...' : '제안 전달하기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', lineHeight: 32 },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: {
    width: '47%',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  catCardSelected: { borderColor: '#2D9B6F', backgroundColor: '#F0F9F4' },
  catEmoji: { fontSize: 22 },
  catValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  catValueSelected: { color: '#1A6B4A' },
  catDesc: { fontSize: 11, color: '#9CA3AF' },
  textarea: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 140,
  },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: -10 },
  anonymousRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  anonymousLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  anonymousDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#2D9B6F',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
