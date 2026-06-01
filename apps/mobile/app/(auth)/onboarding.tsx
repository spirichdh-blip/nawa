import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '@/store/authStore'

// VC 피드백 반영: 단계를 5개로 쪼개어 이탈 방지
// 한 번에 모든 항목 묻지 않음

const STEPS = [
  { id: 0, title: '반갑습니다', subtitle: '몇 가지만 알려주시면\n맞는 지원을 바로 찾아드려요' },
  { id: 1, title: '언제 보호가 종료됐나요?', subtitle: '지원 자격 기준이 되는 날짜예요' },
  { id: 2, title: '지금 어디 사세요?', subtitle: '지역마다 받을 수 있는 지원이 달라요' },
  { id: 3, title: '현재 상황을 알려주세요', subtitle: '수급 현황과 생활 상태를 확인해요' },
  { id: 4, title: '계정을 만들어요', subtitle: '나와와 함께할 계정을 설정해요' },
]

const PROTECTION_TYPES = [
  { value: 'CHILD_CARE_FACILITY', label: '아동양육시설' },
  { value: 'GROUP_HOME', label: '공동생활가정' },
  { value: 'FOSTER_CARE', label: '가정위탁' },
  { value: 'YOUTH_SHELTER', label: '청소년쉼터' },
  { value: 'OTHER', label: '기타' },
]

const REGIONS_SI = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

const STATUSES = [
  { value: 'STUDENT', label: '재학 중', emoji: '📚' },
  { value: 'EMPLOYED', label: '일하고 있어요', emoji: '💼' },
  { value: 'JOB_SEEKING', label: '취업 준비 중', emoji: '🔍' },
  { value: 'INACTIVE', label: '쉬고 있어요', emoji: '🌿' },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const register = useAuthStore(s => s.register)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    birthDate: '',
    protectionType: '',
    protectionEndDate: '',
    regionSi: '',
    regionGu: '',
    status: '',
    receivingJaripSudang: false,
    receivingBasicLiving: false,
    phone: '',
    password: '',
  })

  const update = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const canProceed = () => {
    switch (step) {
      case 0: return form.name.trim().length >= 2
      case 1: return form.protectionType !== '' && form.protectionEndDate !== '' && form.birthDate !== ''
      case 2: return form.regionSi !== ''
      case 3: return form.status !== ''
      case 4: return form.phone.length >= 10 && form.password.length >= 8
      default: return false
    }
  }

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
      return
    }

    setLoading(true)
    try {
      const birthYear = parseInt(form.birthDate.slice(0, 4))
      const birthMonth = parseInt(form.birthDate.slice(4, 6)) - 1
      const birthDay = parseInt(form.birthDate.slice(6, 8))
      const birthDateISO = new Date(birthYear, birthMonth, birthDay).toISOString()

      const endYear = parseInt(form.protectionEndDate.slice(0, 4))
      const endMonth = parseInt(form.protectionEndDate.slice(4, 6)) - 1
      const endDay = parseInt(form.protectionEndDate.slice(6, 8))
      const endDateISO = new Date(endYear, endMonth, endDay).toISOString()

      await register({
        name: form.name,
        phone: form.phone.replace(/-/g, ''),
        password: form.password,
        birthDate: birthDateISO,
        regionSi: form.regionSi,
        regionGu: form.regionGu,
        protectionEndDate: endDateISO,
        protectionType: form.protectionType,
      })

      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert(
        '가입 실패',
        err.response?.data?.error ?? '잠시 후 다시 시도해주세요.',
        [{ text: '확인' }]
      )
    } finally {
      setLoading(false)
    }
  }

  const current = STEPS[step]

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      {/* 프로그레스 바 */}
      <View style={styles.progressBar}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>{current.title}</Text>
        <Text style={styles.stepSubtitle}>{current.subtitle}</Text>

        {step === 0 && (
          <View style={styles.fields}>
            <Field label="이름 (닉네임도 괜찮아요)">
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => update('name', v)}
                placeholder="예: 정세아"
                autoFocus
              />
            </Field>
          </View>
        )}

        {step === 1 && (
          <View style={styles.fields}>
            <Field label="생년월일 (8자리)">
              <TextInput
                style={styles.input}
                value={form.birthDate}
                onChangeText={v => update('birthDate', v)}
                placeholder="예: 20000115"
                keyboardType="number-pad"
                maxLength={8}
              />
            </Field>
            <Field label="보호 종료 날짜 (8자리)">
              <TextInput
                style={styles.input}
                value={form.protectionEndDate}
                onChangeText={v => update('protectionEndDate', v)}
                placeholder="예: 20230301"
                keyboardType="number-pad"
                maxLength={8}
              />
            </Field>
            <Field label="어디서 보호를 받았나요?">
              <View style={styles.chips}>
                {PROTECTION_TYPES.map(t => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    selected={form.protectionType === t.value}
                    onPress={() => update('protectionType', t.value)}
                  />
                ))}
              </View>
            </Field>
          </View>
        )}

        {step === 2 && (
          <View style={styles.fields}>
            <Field label="시/도">
              <View style={styles.chips}>
                {REGIONS_SI.map(r => (
                  <Chip
                    key={r}
                    label={r}
                    selected={form.regionSi === r}
                    onPress={() => update('regionSi', r)}
                  />
                ))}
              </View>
            </Field>
            <Field label="시/군/구 (선택)">
              <TextInput
                style={styles.input}
                value={form.regionGu}
                onChangeText={v => update('regionGu', v)}
                placeholder="예: 마포구"
              />
            </Field>
          </View>
        )}

        {step === 3 && (
          <View style={styles.fields}>
            <Field label="지금 어떻게 지내고 있어요?">
              {STATUSES.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.statusCard,
                    form.status === s.value && styles.statusCardSelected,
                  ]}
                  onPress={() => update('status', s.value)}
                >
                  <Text style={styles.statusEmoji}>{s.emoji}</Text>
                  <Text
                    style={[
                      styles.statusLabel,
                      form.status === s.value && styles.statusLabelSelected,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Field>
            <Field label="자립수당을 받고 있나요?">
              <View style={styles.toggleRow}>
                <Chip
                  label="받고 있어요"
                  selected={form.receivingJaripSudang}
                  onPress={() => update('receivingJaripSudang', true)}
                />
                <Chip
                  label="아직 안 받아요"
                  selected={!form.receivingJaripSudang}
                  onPress={() => update('receivingJaripSudang', false)}
                />
              </View>
            </Field>
            <Field label="기초생활수급을 받고 있나요?">
              <View style={styles.toggleRow}>
                <Chip
                  label="네"
                  selected={form.receivingBasicLiving}
                  onPress={() => update('receivingBasicLiving', true)}
                />
                <Chip
                  label="아니요"
                  selected={!form.receivingBasicLiving}
                  onPress={() => update('receivingBasicLiving', false)}
                />
              </View>
            </Field>
          </View>
        )}

        {step === 4 && (
          <View style={styles.fields}>
            <Field label="전화번호">
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={v => update('phone', v)}
                placeholder="010-0000-0000"
                keyboardType="phone-pad"
                autoFocus
              />
            </Field>
            <Field label="비밀번호 (8자 이상)">
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={v => update('password', v)}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
              />
            </Field>
            <View style={styles.consentBox}>
              <Text style={styles.consentText}>
                가입하면 개인정보 수집·이용에 동의하는 것으로 간주됩니다.
                수집된 정보는 복지 자격 매칭에만 사용되며, 비식별 처리됩니다.
                전담기관에는 앱 비활성 신호만 전달됩니다.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep(s => s - 1)}
          >
            <Text style={styles.backBtnText}>이전</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || loading}
        >
          <Text style={styles.nextBtnText}>
            {loading ? '잠깐만요...' : step === STEPS.length - 1 ? '지원 찾기 시작' : '다음'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Chip({ label, selected, onPress }: {
  label: string; selected: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: { backgroundColor: '#2D9B6F' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  stepSubtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 28 },
  fields: { gap: 24 },
  field: { gap: 10 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#2D9B6F', borderColor: '#2D9B6F' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  statusCardSelected: { borderColor: '#2D9B6F', backgroundColor: '#F0F9F4' },
  statusEmoji: { fontSize: 24 },
  statusLabel: { fontSize: 16, color: '#374151', fontWeight: '500' },
  statusLabelSelected: { color: '#1A6B4A', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  consentBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
  },
  consentText: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  backBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  backBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 16 },
  nextBtn: {
    flex: 2,
    backgroundColor: '#2D9B6F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
