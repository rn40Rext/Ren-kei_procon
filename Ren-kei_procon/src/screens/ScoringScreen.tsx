import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Footprints, Hand, User } from 'lucide-react-native';
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

export default function AnalysisScreen() {
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);

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
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionTitle: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionHead: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleInline: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.sm },

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
