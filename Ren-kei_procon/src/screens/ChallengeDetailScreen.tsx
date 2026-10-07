/**
 * 「師匠からのチャレンジ」の詳細。お題の演舞・出題者・コツを見せて、
 * 自分の演舞で挑戦(採点画面へ)し、採点した演舞をこのお題への挑戦として投稿できる。
 * 実データのお題には、挑戦として投稿された演舞(posts.challengeId)を「挑戦した人の演舞」に並べる。
 * challengeId: 連の管理者が出題した実データ(challenges。docs/design/challenges.md)。
 * id: 見本(サンプル)データ。挑戦人数・勧誘ボタンは見本にだけ出す。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Alert } from '../utils/alert';
import { ChevronLeft, UserPlus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography } from '../theme';
import { Badge, WashiCard, Panel, SectionHeader } from '../components/ui';
import { RenMon, HeaderSeam, NarutoLoader } from '../components/motifs';
import { IconEnbuPlay, IconGeta, IconWagasa, categoryIcon } from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import VideoThumbnail from '../components/VideoThumbnail';
import { subscribeChallengeEntries } from '../repositories/posts';
import { formatAiScore } from '../features/analysis/format';
import { challengeById, DIFFICULTY_TONE, Challenge } from '../data/mockChallenges';
import {
  CHALLENGE_CATEGORY_LABEL,
  CHALLENGE_DIFFICULTY_LABEL,
  subscribeChallenge,
} from '../repositories/challenges';
import type { ChallengeDoc, Post } from '../types/firestore';
import { useMyRole, isRenLeaderClass } from '../data/role';

type Props = NativeStackScreenProps<RootStackParamList, 'Challenge'>;

/** 画面に出す形にそろえたお題(見本と実データの共通形) */
type ChallengeView = Omit<Challenge, 'id' | 'image' | 'participants' | 'advice'> & {
  isSample: boolean;
  advice: { id: string; point: string; detail: string }[];
  image?: string;
  videoUrl?: string;
  participants?: number;
};

/** 見本のお題を画面用の形にする */
function fromSample(c: Challenge): ChallengeView {
  return { ...c, isSample: true };
}

/** 実データのお題を画面用の形にする(肩書きの前に出題した連の名前を付ける) */
function fromDoc(c: ChallengeDoc): ChallengeView {
  return {
    isSample: false,
    title: c.title,
    move: c.move,
    poster: c.posterName,
    posterRole: [c.renName, c.posterRole].filter(Boolean).join(' '),
    posterRen: c.renName,
    category: CHALLENGE_CATEGORY_LABEL[c.category],
    difficulty: CHALLENGE_DIFFICULTY_LABEL[c.difficulty],
    focus: c.focus,
    advice: c.advice.map((a, i) => ({ id: String(i), ...a })),
    videoUrl: c.videoUrl,
  };
}

/** 師匠が出したチャレンジ(お題)の詳細を見て、自分の演舞で挑戦する画面 */
export default function ChallengeDetailScreen({ navigation, route }: Props) {
  const { id, challengeId } = route.params ?? {};
  // 実データのお題(undefined=読み込み中、null=見つからない)
  const [challengeDoc, setChallengeDoc] = useState<ChallengeDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!challengeId) return;
    return subscribeChallenge(challengeId, setChallengeDoc, (e) => {
      console.error('チャレンジの取得に失敗しました', e);
      setChallengeDoc(null);
    });
  }, [challengeId]);

  // このお題への挑戦として投稿された演舞(実データのお題のみ)
  const [entries, setEntries] = useState<Post[]>([]);
  useEffect(() => {
    if (!challengeId) return;
    return subscribeChallengeEntries(challengeId, setEntries, (e) =>
      console.warn('subscribeChallengeEntries', e),
    );
  }, [challengeId]);

  // 見本はIDから探す(見つからなければ先頭のお題)。実データは読み込めたら画面用の形にする
  const ch = useMemo<ChallengeView | null>(() => {
    if (!challengeId) return fromSample(challengeById(id));
    return challengeDoc ? fromDoc(challengeDoc) : null;
  }, [challengeId, id, challengeDoc]);

  // 自分の役割。連の世話役以上なら「連へ勧誘する」ボタンを出す(見本のみ)
  const role = useMyRole();
  const canScout = isRenLeaderClass(role) && ch?.isSample === true;

  // 「師匠からのチャレンジ」は現状すべて見本(サンプル)データで、実在しない人物のため、
  // 実際の招待フロー(RequestScreen)には繋がない(#108レビュー)。
  const scoutPoster = () => {
    Alert.alert('これは見本です', 'このチャレンジは表示用のサンプルのため、実際に招待することはできません。');
  };

  // 実データの読み込み中・見つからないとき
  if (!ch) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        {challengeDoc === undefined ? (
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
  const CatIcon = categoryIcon(ch.category);

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
        {/* お題の演舞。実データはお手本動画(あれば)、見本は写真、どちらも無ければ無地の枠 */}
        {ch.videoUrl ? (
          <View>
            <RenkeiVideo uri={ch.videoUrl} style={styles.video} contentFit="contain" nativeControls />
            <View style={styles.videoBadges}>
              <Badge label="チャレンジ" tone="aka" />
              <Badge label={ch.difficulty} tone={DIFFICULTY_TONE[ch.difficulty]} style={{ marginLeft: spacing.sm }} />
              <Text style={styles.catTagText}>　お手本：{ch.move}</Text>
            </View>
          </View>
        ) : (
        <View style={styles.banner}>
          <ImageBackground source={ch.image ? { uri: ch.image } : undefined} style={[styles.bannerImg, !ch.image && styles.bannerPlain]}>
            <LinearGradient
              colors={['rgba(11,19,43,0.25)', 'rgba(11,19,43,0.85)']}
              style={styles.bannerScrim}
            >
              <View style={styles.bannerTop}>
                {ch.isSample ? <Badge label="見本(サンプル)" tone="outline" style={{ marginRight: spacing.sm }} /> : null}
                <Badge label="チャレンジ" tone="aka" />
                <Badge label={ch.difficulty} tone={DIFFICULTY_TONE[ch.difficulty]} style={{ marginLeft: spacing.sm }} />
              </View>
              {ch.isSample ? (
                <View style={styles.playCircle}>
                  <IconEnbuPlay size={24} color={colors.textOnGold} />
                </View>
              ) : (
                <View style={styles.plainIcon}>
                  <CatIcon size={40} color={colors.gold} />
                </View>
              )}
              <View style={styles.catTag}>
                <CatIcon size={12} color={colors.goldBright} />
                <Text style={styles.catTagText}>　{ch.move}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>
        )}

        {/* お題と出題者 */}
        <View style={styles.head}>
          <Text style={styles.title}>{ch.title}</Text>

          <View style={styles.posterRow}>
            <RenMon size={34} color={colors.gold}>
              <Text style={styles.posterInitial}>{ch.poster.slice(0, 1)}</Text>
            </RenMon>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.posterName}>{ch.poster}</Text>
              <Text style={styles.posterRole}>{ch.posterRole}</Text>
            </View>
          </View>

          {ch.participants !== undefined ? (
            <Text style={styles.participants}>{ch.participants} 人が挑戦中</Text>
          ) : null}

          {canScout ? (
            <TouchableOpacity style={styles.scoutBtn} onPress={scoutPoster} activeOpacity={0.85}>
              <IconWagasa size={15} color={colors.gold} />
              <Text style={styles.scoutBtnText}>　{ch.poster}さんを連へ勧誘する</Text>
              <UserPlus size={14} color={colors.gold} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 見どころ・課題 */}
        <Panel style={styles.focusPanel}>
          <Text style={styles.focusLabel}>詳細</Text>
          <Text style={styles.focusText}>{ch.focus}</Text>
        </Panel>

        {/* 意識してほしいところ(コツの一覧) */}
        <SectionHeader title="意識してほしいところ" />
        <View style={styles.adviceList}>
          {ch.advice.map((a, i) => (
            <WashiCard key={a.id} eyebrow={`コツ ${i + 1}`} style={styles.adviceCard}>
              <Text style={styles.advicePoint}>{a.point}</Text>
              <Text style={styles.adviceDetail}>{a.detail}</Text>
            </WashiCard>
          ))}
        </View>

        {/* 挑戦する */}
        <TouchableOpacity
          style={styles.challengeBtn}
          activeOpacity={0.9}
          onPress={() =>
            // 実データのお題なら、採点画面〜解析結果までお題を引き継ぎ、結果をこのお題に投稿できるようにする
            navigation.navigate('Scoring', challengeId ? { challengeId, challengeTitle: ch.title } : undefined)
          }
        >
          <IconGeta size={17} color={colors.textOnGold} />
          <Text style={styles.challengeBtnText}>　自分の演舞で挑戦する</Text>
        </TouchableOpacity>

        {/* 挑戦した人の演舞(実データのお題のみ)。タップで投稿詳細へ */}
        {challengeId ? (
          <>
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
          </>
        ) : null}

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

  // お題の演舞写真を全幅で表示する枠
  banner: { height: 200 },
  bannerImg: { flex: 1 },
  // 写真の無い実データのお題は無地の枠にし、中央に踊りの種類のアイコンを置く
  bannerPlain: { backgroundColor: colors.indigoRaised },
  plainIcon: { alignItems: 'center', justifyContent: 'center' },
  // お手本動画(縦撮り・横撮りどちらでも全体が映るようにcontainで表示)と、その下のバッジ行
  video: { width: '100%', height: 360, backgroundColor: colors.indigoRaised },
  videoBadges: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  // 写真の上に薄い暗幕をかけ、その上にバッジ・再生ボタン等を乗せる
  bannerScrim: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  bannerTop: { flexDirection: 'row', alignItems: 'center' },
  // 写真の中央に重ねる再生ボタン。丸い金色のボタンとして画面中央に固定表示する
  playCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTag: { flexDirection: 'row', alignItems: 'center' },
  catTagText: { ...typography.metric, color: colors.goldBright },

  // お題の見出し・出題者の行(頭文字の紋・名前・役職)・挑戦人数
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.titleSerif, color: colors.textPrimary },
  posterRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  posterInitial: { ...typography.bodyStrong, color: colors.gold, fontSize: 13 },
  posterName: { ...typography.bodyStrong, color: colors.textPrimary },
  posterRole: { ...typography.caption, color: colors.gold, marginTop: 2 },
  participants: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  // 「連へ勧誘する」ボタン。金色の枠線を付けた控えめなボタンにする
  scoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  scoutBtnText: { ...typography.caption, color: colors.gold, fontWeight: '700' },

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

  // 「挑戦した人の演舞」の横スクロールと、1人分のカード(動画のサムネイル・名前・極め度)と0件の案内
  tryScroll: { paddingHorizontal: spacing.lg },
  tryCard: { width: 132, marginRight: spacing.md },
  tryThumb: { width: '100%', height: 84, borderRadius: radius.sm },
  tryName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.sm },
  tryMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  emptyEntries: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.lg },

});
