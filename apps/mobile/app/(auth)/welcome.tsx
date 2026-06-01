import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'

const { width } = Dimensions.get('window')

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <LinearGradient colors={['#1A6B4A', '#2D9B6F', '#56C794']} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.top}>
        <Text style={styles.logo}>나와</Text>
        <Text style={styles.logoEn}>NAWA</Text>
        <Text style={styles.tagline}>
          받을 수 있는 지원,{'\n'}직접 찾지 않아도 됩니다
        </Text>
      </View>

      <View style={styles.cards}>
        <FeatureCard
          emoji="🔍"
          text="9개 사이트를 뒤지지 않아도\n내 자격에 맞는 지원이 먼저 와요"
        />
        <FeatureCard
          emoji="📋"
          text="서류 준비부터 신청 완료까지\n처음부터 끝까지 함께해요"
        />
        <FeatureCard
          emoji="🔄"
          text="이사·휴학·퇴사 후에도\n바뀐 자격을 자동으로 다시 확인해요"
        />
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/onboarding')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>지원 찾아보기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>이미 가입했어요</Text>
        </TouchableOpacity>

        <Text style={styles.privacy}>
          개인정보는 지원 매칭에만 사용되며, 비식별 처리됩니다.
        </Text>
      </View>
    </LinearGradient>
  )
}

function FeatureCard({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logo: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
  },
  logoEn: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 6,
    marginTop: -4,
    marginBottom: 20,
  },
  tagline: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },
  cards: { gap: 10, marginBottom: 28 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardEmoji: { fontSize: 24 },
  cardText: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 20 },
  bottom: { paddingBottom: 40, gap: 12 },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#1A6B4A', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  privacy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
})
