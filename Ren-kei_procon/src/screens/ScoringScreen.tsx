import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Music2, Footprints, Hand, User } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { IconOdoriko } from '../components/awaIcons';
import { HeaderSeam, KumihimoRule } from '../components/motifs';
import { colors, spacing, radius, typography, lexicon } from '../theme';

type DanceType = "male" | "female";
type ScorePart = "feet" | "hands" | "whole";

type AnalysisScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'Scoring'>;

const DANCE_OPTIONS: { key: DanceType; label: string; note: string }[] = [
  { key: 'male', label: '男踊り', note: '腰を落とし地を踏む力強い型' },
  { key: 'female', label: '女踊り', note: '爪先立ちで流れる優美な型' },
];

const PART_OPTIONS: { key: ScorePart; label: string; note: string; Icon: typeof Footprints }[] = [
  { key: 'feet', label: '足捌き', note: '接地・踵の浮き沈み・体重移動', Icon: Footprints },
  { key: 'hands', label: '手・団扇', note: '肘の高さ・指先・返しの角度', Icon: Hand },
  { key: 'whole', label: '全体の調和', note: '上体のぶれ・二拍子との一致', Icon: User },
];

// リズム判定の基準テンポ。既定はさゝゆり連の実測 112 BPM
const CHO_OPTIONS = [
  { bpm: 96, label: 'ゆったり' },
  { bpm: 104, label: 'のんびり調子' },
  { bpm: 112, label: '基準（標準）' },
  { bpm: 120, label: '早調子' },
  { bpm: 128, label: '速い' },
];

export default function AnalysisScreen() {
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);
  const [baseBpm, setBaseBpm] = useState(112);

  const navigation = useNavigation<AnalysisScreenNavigationProp>();
  const ready = danceType !== null && scorePart !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconOdoriko size={22} color={colors.gold} style={styles.headerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>自主稽古・演舞解析</Text>
          <Text style={styles.headerSub}>手本に重ねて撮り、{lexicon.aiAdvice}を受ける</Text>
        </View>
        <AppMenu />
      </View>
      <HeaderSeam />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ぞめき調子（リズム判定の基準テンポ） */}
        <View style={styles.sectionHead}>
          <KumihimoRule width={20} />
          <Text style={styles.sectionTitleInline}>ぞめき調子（基準テンポ）</Text>
        </View>
        <Text style={styles.hint}>お囃子のテンポに合わせて選びます。練習は本番より落としたテンポでも構いません。</Text>
        <View style={styles.choRow}>
          {CHO_OPTIONS.map((c) => {
            const active = baseBpm === c.bpm;
            return (
              <TouchableOpacity
                key={c.bpm}
                style={[styles.choBtn, active && styles.choBtnActive]}
                onPress={() => setBaseBpm(c.bpm)}
                activeOpacity={0.85}
              >
                <Music2 size={15} color={active ? colors.textOnGold : colors.gold} />
                <Text style={[styles.choLabel, active && styles.choLabelActive]}>{c.bpm} BPM</Text>
                <Text style={[styles.choBpm, active && styles.choLabelActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 踊りの種類 */}
        <View style={styles.sectionHead}>
          <KumihimoRule width={20} />
          <Text style={styles.sectionTitleInline}>踊りの型</Text>
        </View>
        {DANCE_OPTIONS.map((d) => {
          const active = danceType === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              onPress={() => setDanceType(d.key)}
              style={[styles.optionCard, active && styles.optionCardActive]}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{d.label}</Text>
                <Text style={styles.optionNote}>{d.note}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioOn]} />
            </TouchableOpacity>
          );
        })}

        {/* 見てほしい部分 */}
        <View style={styles.sectionHead}>
          <KumihimoRule width={20} />
          <Text style={styles.sectionTitleInline}>重点的に見てほしい所</Text>
        </View>
        {PART_OPTIONS.map(({ key, label, note, Icon }) => {
          const active = scorePart === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setScorePart(key)}
              style={[styles.optionCard, active && styles.optionCardActive]}
              activeOpacity={0.85}
            >
              <Icon size={19} color={active ? colors.gold : colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
                <Text style={styles.optionNote}>{note}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioOn]} />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          disabled={!ready}
          style={[styles.nextButton, !ready && styles.nextButtonDisabled]}
          onPress={() => {
            if (danceType === null || scorePart === null) return;
            navigation.navigate('Camera', { danceType, scorePart, baseBpm });
          }}
        >
          <Text style={[styles.nextButtonText, !ready && styles.nextButtonTextDisabled]}>
            {ready ? '演舞を撮影する' : '型と重点を選んでください'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.indigoLine },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionTitle: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionHead: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleInline: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 16 },

  choRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choBtn: {
    minWidth: '30%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
  },
  choBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  choLabel: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.sm },
  choLabelActive: { color: colors.textOnGold },
  choBpm: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
  },
  optionCardActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  optionLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  optionLabelActive: { color: colors.gold },
  optionNote: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },

  nextButton: {
    backgroundColor: colors.gold,
    padding: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  nextButtonDisabled: { backgroundColor: colors.indigoRaised },
  nextButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  nextButtonTextDisabled: { color: colors.textMuted },
});
