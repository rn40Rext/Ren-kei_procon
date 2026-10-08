/**
 * 「師匠からのチャレンジ」の詳細。連の管理者が出題したお題(challenges。docs/design/challenges.md)の
 * お手本動画・出題者・コツを見せて、「自分の演舞で挑戦する」(AI採点へ。結果の画面から、
 * このお題への挑戦として投稿できる)と、「AI採点なしで挑戦する」(採点せずに撮って・選んで、
 * このお題への挑戦として投稿する)で挑戦できる。
 * 挑戦として投稿された演舞(posts.challengeId)は「挑戦した人の演舞」に並べる。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { ChevronLeft, Film } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography } from '../theme';
import { Badge, WashiCard, Panel, SectionHeader } from '../components/ui';
import { RenMon, HeaderSeam, NarutoLoader } from '../components/motifs';
import { IconGeta, categoryIcon } from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import VideoThumbnail from '../components/VideoThumbnail';
import { subscribeChallengeEntries } from '../repositories/posts';
import { formatAiScore } from '../features/analysis/format';
import {
  CHALLENGE_CATEGORY_LABEL,
  CHALLENGE_DIFFICULTY_LABEL,
  subscribeChallenge,
} from '../repositories/challenges';
import type { ChallengeDifficulty, ChallengeDoc, Post } from '../types/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'Challenge'>;

/** 難易度ごとのバッジの色(初級=枠線、中級=金、上級=朱) */
const DIFFICULTY_TONE: Record<ChallengeDifficulty, 'gold' | 'outline' | 'aka'> = {
  beginner: 'outline',
  intermediate: 'gold',
  advanced: 'aka',
};

/** 師匠が出したチャレンジ(お題)の詳細を見て、自分の演舞で挑戦する画面 */
export default function ChallengeDetailScreen({ navigation, route }: Props) {
  const { challengeId } = route.params;
  // お題(undefined=読み込み中、null=見つからない)
  const [challenge, setChallenge] = useState<ChallengeDoc | null | undefined>(undefined);
  useEffect(() => {
    return subscribeChallenge(challengeId, setChallenge, (e) => {
      console.error('チャレンジの取得に失敗しました', e);
      setChallenge(null);
    });
  }, [challengeId]);

  // このお題への挑戦として投稿された演舞
  const [entries, setEntries] = useState<Post[]>([]);
  useEffect(() => {
    return subscribeChallengeEntries(challengeId, setEntries, (e) =>
      console.warn('subscribeChallengeEntries', e),
    );
  }, [challengeId]);

  // 出題者の肩書き(出題した連の名前 + 任意の肩書き)
  const posterRole = useMemo(
    () => (challenge ? [challenge.renName, challenge.posterRole].filter(Boolean).join(' ') : ''),
    [challenge],
  );

  // 読み込み中・見つからないとき
  if (!challenge) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        {challenge === undefined ? (
          <NarutoLoader size={28} color={colors.gold} />
        ) : (
          <>
            <Text style={styles.notFound}>このチャレンジは見つかりませんでした（削除された可能性があります）</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>戻る</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    );
  }
  const category = CHALLENGE_CATEGORY_LABEL[challenge.category];
  const difficulty = CHALLENGE_DIFFICULTY_LABEL[challenge.difficulty];
  const CatIcon = categoryIcon(category);

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー: 戻るボタン・画面名・メニュー */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>チャレンジ</Text>
        <AppMenu />
      </View>
      <HeaderSeam />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* お題の演舞。お手本動画があれば再生でき、無ければ無地の枠に踊りの種類のアイコンを出す */}
        {challenge.videoUrl ? (
          <RenkeiVideo uri={challenge.videoUrl} style={styles.video} contentFit="contain" nativeControls />
        ) : (
          <View style={[styles.banner, styles.bannerPlain]}>
            <CatIcon size={40} color={colors.gold} />
          </View>
        )}
        <View style={styles.videoBadges}>
          <Badge label="チャレンジ" tone="aka" />
          <Badge label={difficulty} tone={DIFFICULTY_TONE[challenge.difficulty]} style={{ marginLeft: spacing.sm }} />
          <CatIcon size={12} color={colors.goldBright} style={{ marginLeft: spacing.sm }} />
          <Text style={styles.catTagText}>　{challenge.move}</Text>
        </View>

        {/* お題と出題者 */}
        <View style={styles.head}>
          <Text style={styles.title}>{challenge.title}</Text>

          <View style={styles.posterRow}>
            <RenMon size={34} color={colors.gold}>
              <Text style={styles.posterInitial}>{challenge.posterName.slice(0, 1)}</Text>
            </RenMon>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.posterName}>{challenge.posterName}</Text>
              <Text style={styles.posterRole}>{posterRole}</Text>
            </View>
          </View>
        </View>

        {/* 見どころ・課題 */}
        <Panel style={styles.focusPanel}>
          <Text style={styles.focusLabel}>詳細</Text>
          <Text style={styles.focusText}>{challenge.focus}</Text>
        </Panel>

        {/* 意識してほしいところ(コツの一覧) */}
        <SectionHeader title="意識してほしいところ" />
        <View style={styles.adviceList}>
          {challenge.advice.map((a, i) => (
            <WashiCard key={i} eyebrow={`コツ ${i + 1}`} style={styles.adviceCard}>
              <Text style={styles.advicePoint}>{a.point}</Text>
              {a.detail ? <Text style={styles.adviceDetail}>{a.detail}</Text> : null}
            </WashiCard>
          ))}
        </View>

        {/* 挑戦する。採点画面〜解析結果までお題を引き継ぎ、結果をこのお題に投稿できるようにする */}
        <TouchableOpacity
          style={styles.challengeBtn}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Scoring', { challengeId, challengeTitle: challenge.title })}
        >
          <IconGeta size={17} color={colors.textOnGold} />
          <Text style={styles.challengeBtnText}>　自分の演舞で挑戦する</Text>
        </TouchableOpacity>
        {/* AIの採点をせずに挑戦する。撮って(選んで)このお題に投稿する画面へ */}
        <TouchableOpacity
          style={[styles.challengeBtn, styles.challengeBtnSub]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('ChallengeEntry', { challengeId, challengeTitle: challenge.title })}
        >
          <Film size={17} color={colors.gold} />
          <Text style={[styles.challengeBtnText, styles.challengeBtnSubText]}>　AI採点なしで挑戦する</Text>
        </TouchableOpacity>

        {/* 挑戦した人の演舞。タップで投稿詳細へ */}
        <SectionHeader title={`挑戦した人の演舞（${entries.length}）`} />
        {entries.length === 0 ? (
          <Text style={styles.emptyEntries}>まだ挑戦した人はいません。最初の挑戦者になりましょう。</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tryScroll}>
            {entries.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.tryCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('VideoDetail', { postId: p.id })}
              >
                <VideoThumbnail uri={p.videoUrl} style={styles.tryThumb} />
                <Text style={styles.tryName} numberOfLines={1}>{p.authorName}</Text>
                <Text style={styles.tryMeta} numberOfLines={1}>{formatAiScore(p.score)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  // 読み込み中・見つからないときは中央に案内を出す
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  notFound: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },

  // 画面上部のヘッダー。「戻る」・タイトル・メニューを横一列に並べる
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 90 },
  backText: { ...typography.caption, color: colors.gold, marginLeft: 2 },
  topTitle: { ...typography.headingSerif, color: colors.textPrimary },

  scroll: { paddingBottom: spacing.xl },

  // お手本動画が無いお題の枠(無地にし、中央に踊りの種類のアイコンを置く)
  banner: { height: 200 },
  bannerPlain: { backgroundColor: colors.indigoRaised, alignItems: 'center', justifyContent: 'center' },
  // お手本動画(縦撮り・横撮りどちらでも全体が映るようにcontainで表示)と、その下のバッジ行
  video: { width: '100%', height: 360, backgroundColor: colors.indigoRaised },
  videoBadges: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  // 型・所作の文字
  catTagText: { ...typography.metric, color: colors.goldBright },

  // お題の見出し・出題者の行(頭文字の紋・名前・役職)
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.titleSerif, color: colors.textPrimary },
  posterRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  posterInitial: { ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  posterName: { ...typography.bodyStrong, color: colors.textPrimary },
  posterRole: { ...typography.caption, color: colors.gold, marginTop: 2 },

  // 「詳細」の枠
  focusPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md },
  focusLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  focusText: { ...typography.body, color: colors.textSecondary },

  // アドバイスのカード(和紙風の明るい背景なので、文字は濃い色にする)
  adviceList: { paddingHorizontal: spacing.lg },
  adviceCard: { marginBottom: spacing.md },
  advicePoint: { ...typography.headingSerif, color: colors.indigoDeep },
  adviceDetail: { ...typography.body, color: '#3A3427', marginTop: spacing.sm, lineHeight: 22 },

  // 「自分の演舞で挑戦する」ボタン。横幅いっぱいの大きな金色ボタンにする
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  challengeBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  // 「AI採点なしで挑戦する」(同じ大きさで、枠線だけの控えめな見た目)
  challengeBtnSub: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gold },
  challengeBtnSubText: { color: colors.gold },

  // 「挑戦した人の演舞」の横スクロールと、1人分のカード(動画のサムネイル・名前・極め度)と0件の案内
  tryScroll: { paddingHorizontal: spacing.lg },
  tryCard: { width: 132, marginRight: spacing.md },
  tryThumb: { width: '100%', height: 84, borderRadius: radius.sm },
  tryName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.sm },
  tryMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  emptyEntries: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },

});
