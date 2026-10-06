import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Footprints, Hand, User } from 'lucide-react-native';
import AppMenu from '../components/AppMenu';
import { RenKeiMark } from '../components/Brand';
import { HeaderSeam, KumihimoRule } from '../components/motifs';
import { colors, spacing, radius, typography, lexicon } from '../theme';

/** 踊りの型(男踊り/女踊り)と、重点的に採点する部位(足/手/全体) */
type DanceType = "male" | "female";
type ScorePart = "feet" | "hands" | "whole";

/** この画面で使う画面遷移の型 */
type AnalysisScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'Scoring'>;

/** 踊りの型の選択肢(表示名と短い説明) */
const DANCE_OPTIONS: { key: DanceType; label: string; note: string }[] = [
  { key: 'male', label: '男踊り', note: '腰を落とし地を踏む力強い型' },
  { key: 'female', label: '女踊り', note: '爪先立ちで流れる優美な型' },
];

/** 重点部位の選択肢(表示名・何を見るか・アイコン) */
const PART_OPTIONS: { key: ScorePart; label: string; note: string; Icon: typeof Footprints }[] = [
  { key: 'feet', label: '足捌き', note: '接地・踵の浮き沈み・体重移動', Icon: Footprints },
  { key: 'hands', label: '手・団扇', note: '肘の高さ・指先・返しの角度', Icon: Hand },
  { key: 'whole', label: '全体の調和', note: '上体のぶれ・二拍子との一致', Icon: User },
];

/** U-02の前段。踊りの型(男踊り/女踊り)と重点部位を選び、CameraScreenへ渡す */
export default function AnalysisScreen() {
  // 選んだ踊りの型と重点部位(未選択なら null)
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);

  const navigation = useNavigation<AnalysisScreenNavigationProp>();
  // 両方選んだら撮影へ進める
  const ready = danceType !== null && scorePart !== null;

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー: アイコン・画面名・説明とメニュー */}
      <View style={styles.header}>
        <RenKeiMark size={36} style={styles.headerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>自主稽古・演舞解析</Text>
          <Text style={styles.headerSub}>踊りを撮って、{lexicon.aiAdvice}を受ける</Text>
        </View>
        <AppMenu />
      </View>
      <HeaderSeam />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 踊りの種類 */}
        <View style={styles.sectionHead}>
          <KumihimoRule width={20} />
          <Text style={styles.sectionTitleInline}>踊りの型</Text>
        </View>
        {DANCE_OPTIONS.map((d) => {
          const active = danceType === d.key;
          return (
            // 踊りの型の選択肢1つ分。選ぶと金色の枠になり、右端の丸が塗られる
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
            // 重点部位の選択肢1つ分(アイコン・名前・何を見るか)
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

        {/* 次へ進むボタン。型と重点を両方選ぶまで押せない。選んだ値を撮影画面に渡す */}
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
  // 画面全体の背景と、アイコン・画面名・説明を並べるヘッダー
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.indigoLine },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { ...typography.titleSerif, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  // スクロール部分の余白と、セクション見出し(組紐の飾り + 金色の文字)
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionTitle: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionHead: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleInline: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.sm },

  // 選択肢1つ分のカード(踊りの型・重点部位どちらにも使う)。右端に丸いラジオボタンを置く
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
  // 選択中のカードは金色の枠・背景にする
  optionCardActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  // 選択肢の名前(選択中は金色)・説明と、丸いラジオボタン
  optionLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  optionLabelActive: { color: colors.gold },
  optionNote: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },

  // 「演舞を撮影する」ボタン。両方選ぶまでは灰色にして押せないようにする
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
