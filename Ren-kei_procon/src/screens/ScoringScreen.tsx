import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Layers, Music2, Footprints, Hand, User } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
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

const CHO_OPTIONS = [
  { key: 'nonbiri', label: 'のんびり調子', bpm: 106 },
  { key: 'haya', label: '早調子', bpm: 118 },
];

export default function AnalysisScreen() {
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);
  const [cho, setCho] = useState(CHO_OPTIONS[1].key);
  const [ghost, setGhost] = useState(true);

  const navigation = useNavigation<AnalysisScreenNavigationProp>();
  const ready = danceType !== null && scorePart !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>自主稽古・演舞解析</Text>
          <Text style={styles.headerSub}>手本に重ねて撮り、{lexicon.aiAdvice}を受ける</Text>
        </View>
        <AppMenu />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 手本重ね合わせ（ゴースト） */}
        <TouchableOpacity
          style={[styles.ghostCard, ghost && styles.ghostCardOn]}
          activeOpacity={0.85}
          onPress={() => setGhost((v) => !v)}
        >
          <Layers size={20} color={ghost ? colors.textOnGold : colors.gold} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[styles.ghostTitle, ghost && styles.ghostTitleOn]}>手本重ね合わせ（ゴースト）</Text>
            <Text style={[styles.ghostNote, ghost && styles.ghostNoteOn]}>
              師匠のお手本を半透明でガイド表示する
            </Text>
          </View>
          <View style={[styles.toggle, ghost && styles.toggleOn]}>
            <View style={[styles.knob, ghost && styles.knobOn]} />
          </View>
        </TouchableOpacity>

        {/* ぞめき調子（BPM） */}
        <Text style={styles.sectionTitle}>ぞめき調子</Text>
        <View style={styles.choRow}>
          {CHO_OPTIONS.map((c) => {
            const active = cho === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.choBtn, active && styles.choBtnActive]}
                onPress={() => setCho(c.key)}
                activeOpacity={0.85}
              >
                <Music2 size={15} color={active ? colors.textOnGold : colors.gold} />
                <Text style={[styles.choLabel, active && styles.choLabelActive]}>{c.label}</Text>
                <Text style={[styles.choBpm, active && styles.choLabelActive]}>{c.bpm} BPM・二拍子</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 踊りの種類 */}
        <Text style={styles.sectionTitle}>踊りの型</Text>
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
        <Text style={styles.sectionTitle}>重点的に見てほしい所</Text>
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
            navigation.navigate('Camera', { danceType, scorePart });
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
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  ghostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
  },
  ghostCardOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  ghostTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  ghostTitleOn: { color: colors.textOnGold },
  ghostNote: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  ghostNoteOn: { color: 'rgba(11,19,43,0.7)' },
  toggle: { width: 40, height: 24, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.akaDeep },
  knob: { width: 18, height: 18, borderRadius: radius.pill, backgroundColor: colors.textMuted },
  knobOn: { backgroundColor: colors.kinari, alignSelf: 'flex-end' },

  sectionTitle: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.md },

  choRow: { flexDirection: 'row', gap: spacing.md },
  choBtn: {
    flex: 1,
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
