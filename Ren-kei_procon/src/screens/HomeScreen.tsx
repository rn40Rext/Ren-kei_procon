import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../utils/alert';
import * as ImagePicker from 'expo-image-picker';
import { X, Bell } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { SectionHeader, Badge, Chip, MetricRow } from '../components/ui';
import { ChochinGarland, Noren, SeigaihaBand, RenMon, KumihimoRule, AwaDivider } from '../components/motifs';
import {
  IconEnbuPlay,
  IconUchiwa,
  IconNaruko,
  IconMakimono,
  IconTenugui,
  IconGeta,
  IconWagasa,
  categoryIcon,
} from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import RenkeiVideo from '../components/RenkeiVideo';
import { RenKeiWordmark } from '../components/Brand';
import { auth } from '../config/firebaseConfig';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import {
  subscribePosts,
  loadCachedPosts,
  uploadVideoAndPublish,
  isLiked,
  toggleLike,
  POST_TAG_OPTIONS,
} from '../repositories/posts';
import type { Post as PostDoc } from '../types/firestore';
import {
  filterChips,
  feedTags,
  feedPosts as seedFeed,
  myPosts as seedMine,
  ME,
  FeedPost,
} from '../data/mockEnbu';
import { challenges } from '../data/mockChallenges';
import { awaImage } from '../data/awaImages';


/** 阿波おどり本番（毎年 8/11〜15）まであと何日か。過ぎていれば翌年を数える。 */
function daysToFestival(): number {
  const now = new Date();
  let year = now.getFullYear();
  let start = new Date(year, 7, 11); // 8月11日
  if (now.getTime() > new Date(year, 7, 15, 23, 59).getTime()) {
    start = new Date(year + 1, 7, 11);
  }
  return Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 86400000));
}

type HeroLike = {
  kind: 'real' | 'dummy';
  category: string;
  kimeRate: number | undefined;
  timeAgo: string;
  authorRen: string;
  title: string;
};

/** ヒーロー画像／動画に重ねる帯（見出し・カウントダウン・再生マーク・題）。 */
/**
 * 動画の上には再生ボタンだけを重ねる(文字を動画に重ねないでほしいという
 * フィードバックを受け、見出し・タグ・題名などは動画の下(renderHeroInfo)に
 * 移した)。
 */
function renderHeroVideoOverlay() {
  return (
    <View style={styles.heroPlayWrap} pointerEvents="none">
      <View style={styles.heroPlayCircle}>
        <IconEnbuPlay size={24} color={colors.textOnGold} />
      </View>
    </View>
  );
}

function renderHeroInfo(hero: HeroLike, festivalDays: number) {
  return (
    <>
      <View style={styles.heroInfoTopRow}>
        <View style={styles.heroTopEyebrowRow}>
          <KumihimoRule width={18} />
          <Text style={styles.heroEyebrowText}>
            　{hero.kind === 'dummy' ? '見本(サンプル)' : 'あなたの直近の投稿'}
          </Text>
        </View>
        <View style={styles.countdownChip}>
          <Text style={styles.countdownText}>阿波おどり本番まで あと {festivalDays} 日</Text>
        </View>
      </View>

      <View style={styles.heroImgFooter}>
        <View style={styles.heroTopRow}>
          <Badge label={hero.category} tone="aka" />
          <Badge
            label={typeof hero.kimeRate === 'number' ? `極め度 ${hero.kimeRate}%` : '未採点'}
            tone="dark"
            style={styles.badgeGap}
          />
          <Badge label={hero.timeAgo} tone="outline" style={styles.badgeGap} />
        </View>
        <Text style={styles.heroRen}>{hero.authorRen}</Text>
        <Text style={styles.heroName} numberOfLines={2}>{hero.title}</Text>
      </View>
    </>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { width: SCREEN_W } = useWindowDimensions();
  const HERO_H = Math.min(Math.round(SCREEN_W * 0.64), 320);
  const [activeChip, setActiveChip] = useState(filterChips[0]);
  const [feedTag, setFeedTag] = useState(feedTags[0]);
  const [search, setSearch] = useState('');

  const scrollY = useRef(new Animated.Value(0)).current;
  const festivalDays = useMemo(() => daysToFestival(), []);

  // ダミー：投稿はローカル state で保持（自分の投稿 + 交流フィード）
  const [feed, setFeed] = useState<FeedPost[]>([...seedMine, ...seedFeed]);
  const [posting, setPosting] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 実データ：交流広場の投稿（posts）を購読
  const [realPosts, setRealPosts] = useState<PostDoc[]>([]);
  const gotLive = useRef(false);
  useEffect(() => {
    // まず前回セッションの保存分を即表示（Firestore 応答前・オフラインでも残る）
    loadCachedPosts().then((cached) => {
      if (!gotLive.current && cached.length) setRealPosts(cached);
    });
    const unsub = subscribePosts(
      (posts) => {
        gotLive.current = true;
        setRealPosts(posts);
      },
      (e) => console.warn('subscribePosts', e),
    );
    return unsub;
  }, []);

  const uid = auth.currentUser?.uid;

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(uid, setUnreadCount, () => undefined);
  }, [uid]);

  const openEnbu = (id: string) => navigation.navigate('VideoDetail', { id });
  const openPost = (postId: string) => navigation.navigate('VideoDetail', { postId });

  // 自分が投稿した演舞（新しい順）。実データの投稿があればそれを最優先で主役に据える。
  const mine = useMemo(() => feed.filter((p) => p.mine), [feed]);
  const myRealPosts = useMemo(
    () => realPosts.filter((p) => p.userId && p.userId === uid),
    [realPosts, uid],
  );
  const realHero = myRealPosts[0] ?? null;
  const dummyHero = mine[0] ?? null;
  const otherMine = realHero ? mine : mine.slice(1);
  // フィード一覧・「ほかのあなたの投稿」はヒーローに出している最新投稿を除いて表示
  const feedRealPosts = useMemo(
    () => realPosts.filter((p) => p.id !== realHero?.id),
    [realPosts, realHero],
  );

  // フィード上で直接「拍手」できるように、表示中の投稿の自分のいいね状態を持つ
  // （数そのものはsubscribePostsのライブ購読が反映するので、ここではliked表示だけ管理する）。
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [clapBusyId, setClapBusyId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    feedRealPosts.forEach((p) => {
      if (likedMap[p.id] !== undefined) return;
      isLiked(p.id).then((v) => {
        if (alive) setLikedMap((m) => ({ ...m, [p.id]: v }));
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedRealPosts]);

  const onFeedClap = async (postId: string) => {
    if (clapBusyId) return;
    const currentlyLiked = !!likedMap[postId];
    setClapBusyId(postId);
    setLikedMap((m) => ({ ...m, [postId]: !currentlyLiked }));
    try {
      await toggleLike(postId, currentlyLiked);
    } catch {
      setLikedMap((m) => ({ ...m, [postId]: currentlyLiked }));
      Alert.alert('エラー', '拍手の送信に失敗しました');
    } finally {
      setClapBusyId(null);
    }
  };

  // ヒーローの下の横並び：自分の実投稿（ヒーロー以外）＋サンプルの自分の投稿
  const otherMineItems = useMemo(
    () => [
      ...myRealPosts
        .filter((p) => p.id !== realHero?.id)
        .map((p) => ({
          key: p.id,
          kind: 'real' as const,
          videoUrl: p.videoUrl,
          title: p.title,
          meta: `あなたの投稿・拍手 ${p.likeCount}`,
          onPress: () => openPost(p.id),
        })),
      ...otherMine.map((p) => ({
        key: p.id,
        kind: 'dummy' as const,
        image: p.image,
        title: p.title,
        meta: `${p.timeAgo}・拍手 ${p.claps}`,
        onPress: () => openEnbu(p.id),
      })),
    ],
    [myRealPosts, realHero, otherMine],
  );

  const hero = realHero
    ? {
        kind: 'real' as const,
        title: realHero.title,
        authorRen: '交流広場に投稿',
        category: realHero.tags[0] ?? '演舞',
        kimeRate: realHero.score,
        timeAgo: 'あなたの投稿',
        description: realHero.description,
        videoUrl: realHero.videoUrl,
        claps: realHero.likeCount,
        comments: realHero.commentCount,
        duration: undefined as string | undefined,
        onPress: () => openPost(realHero.id),
      }
    : dummyHero
      ? {
          kind: 'dummy' as const,
          title: dummyHero.title,
          authorRen: dummyHero.authorRen,
          category: dummyHero.category,
          kimeRate: dummyHero.kimeRate,
          timeAgo: dummyHero.timeAgo,
          description: dummyHero.description,
          image: dummyHero.image,
          claps: dummyHero.claps,
          comments: dummyHero.comments,
          duration: dummyHero.duration,
          onPress: () => openEnbu(dummyHero.id),
        }
      : null;

  const visibleFeed = useMemo(() => {
    return feed.filter((p) => {
      const tagOk = feedTag === feedTags[0] || p.tags.includes(feedTag);
      const q = search.trim();
      const searchOk =
        !q || p.title.includes(q) || p.author.includes(q) || p.authorRen.includes(q);
      return tagOk && searchOk;
    });
  }, [feed, feedTag, search]);

  const resetDraft = () => {
    setDraftTitle('');
    setDraftDesc('');
    setDraftTags([]);
    setVideoUri(null);
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('権限が必要です', '動画を選ぶにはライブラリへのアクセスを許可してください。');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 120,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  };

  // 初心者サポート：見てほしい演舞をその場で撮って、そのまま解析・投稿に回せるように
  const recordVideo = async () => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert('権限が必要です', '撮影にはカメラへのアクセスを許可してください。');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 120,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  };

  const submitPost = async () => {
    if (!draftTitle.trim() || submitting) return;

    // 動画が選ばれていれば実データとして投稿（GitHub バックエンド）
    if (videoUri) {
      if (!auth.currentUser) {
        Alert.alert('ログインが必要です', '投稿するにはログインしてください。');
        return;
      }
      setSubmitting(true);
      try {
        await uploadVideoAndPublish({
          uri: videoUri,
          title: draftTitle,
          description: draftDesc,
          tags: draftTags,
        });
        setPosting(false);
        resetDraft();
        setFeedTag(feedTags[0]);
      } catch (e: any) {
        Alert.alert('投稿に失敗しました', e?.message ?? '時間をおいて再度お試しください。');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 動画なし：従来どおりサンプル（ローカル）に追加
    setFeed((prev) => [
      {
        id: `me-${Date.now()}`,
        title: draftTitle.trim(),
        author: ME.name,
        authorRen: ME.ren,
        category: '男踊り',
        tags: draftTags,
        kimeRate: 80,
        claps: 0,
        comments: 0,
        timeAgo: 'たった今',
        duration: '00:00',
        description: draftDesc.trim() || '投稿したばかりの演舞です。',
        image: awaImage('男踊り', Math.floor(Math.random() * 7)),
        mine: true,
      },
      ...prev,
    ]);
    setPosting(false);
    resetDraft();
    setFeedTag(feedTags[0]);
  };

  const toggleDraftTag = (t: string) =>
    setDraftTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <SafeAreaView style={styles.container}>
      <ChochinGarland width={SCREEN_W} count={7} height={44} style={styles.topGarland} />

      {/* ヘッダー：藍染めの暖簾風。アプリ銘を中央に */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="通知"
        >
          <Bell size={20} color={colors.gold} />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <RenKeiWordmark size={21} />
          <Text style={styles.logoSub}>稽古と交流の広場</Text>
        </View>
        <AppMenu>
          <View style={styles.menuFilterHead}>
            <IconTenugui size={14} color={colors.gold} />
            <Text style={styles.menuPanelLabel}>　連・流派・調子で絞り込む</Text>
          </View>
          <View style={styles.menuChipWrap}>
            {filterChips.map((c) => (
              <Chip
                key={c}
                label={c}
                active={activeChip === c}
                onPress={() => setActiveChip(c)}
                style={styles.menuChip}
              />
            ))}
          </View>
        </AppMenu>
      </View>
      <Noren width={SCREEN_W} height={24} style={styles.noren} />

      {/* 演舞の投稿（常に上部に固定） */}
      <TouchableOpacity
        style={styles.postBar}
        activeOpacity={0.9}
        onPress={() => setPosting(true)}
      >
        <IconUchiwa size={16} color={colors.textOnGold} />
        <Text style={styles.postBarText}>　演舞を投稿する</Text>
      </TouchableOpacity>

      {activeChip !== filterChips[0] ? (
        <View style={styles.activeFilterBar}>
          <IconTenugui size={13} color={colors.gold} />
          <Text style={styles.activeFilterText}>　絞り込み：{activeChip}</Text>
          <Text style={styles.activeFilterClear} onPress={() => setActiveChip(filterChips[0])}>
            解除
          </Text>
        </View>
      ) : null}

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* 自分が投稿した演舞（実データがあれば動画、無ければサンプル画像） */}
        {hero ? (
          <View style={styles.hero}>
            <TouchableOpacity
              style={[styles.heroImageWrap, { height: HERO_H }]}
              activeOpacity={0.92}
              onPress={hero.onPress}
            >
              {hero.kind === 'real' ? (
                <View style={styles.heroImage}>
                  <RenkeiVideo uri={hero.videoUrl} style={styles.heroVideo} contentFit="cover" muted />
                  <View style={styles.heroImgGrad}>{renderHeroVideoOverlay()}</View>
                </View>
              ) : (
                <ImageBackground source={{ uri: hero.image }} style={styles.heroImage}>
                  <View style={styles.heroImgGrad}>{renderHeroVideoOverlay()}</View>
                </ImageBackground>
              )}
            </TouchableOpacity>

            <View style={styles.heroBody}>
              {renderHeroInfo(hero, festivalDays)}
              {hero.description ? (
                <Text style={styles.heroDesc}>{hero.description}</Text>
              ) : null}
              <MetricRow
                style={styles.heroMetrics}
                items={[
                  { label: '演舞尺', value: hero.duration ?? '--:--' },
                  { label: '拍手', value: `${hero.claps}` },
                  { label: '門下生の声', value: `${hero.comments}` },
                ]}
              />
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={() => navigation.navigate('Scoring')}
                activeOpacity={0.85}
              >
                <IconGeta size={15} color={colors.textPrimary} />
                <Text style={styles.syncBtnText}>　手本と並べて撮り直す</Text>
              </TouchableOpacity>

              {otherMineItems.length > 0 ? (
                <>
                  <Text style={styles.otherMineLabel}>ほかのあなたの投稿</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.otherMineRow}
                  >
                    {otherMineItems.map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={styles.otherMineCard}
                        activeOpacity={0.9}
                        onPress={item.onPress}
                      >
                        {item.kind === 'real' ? (
                          <View style={styles.otherMineThumb}>
                            <RenkeiVideo uri={item.videoUrl} style={styles.otherMineThumbVideo} contentFit="cover" muted />
                          </View>
                        ) : (
                          <ImageBackground
                            source={{ uri: item.image }}
                            style={styles.otherMineThumb}
                            imageStyle={{ borderRadius: radius.sm }}
                          />
                        )}
                        <Text style={styles.otherMineTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.otherMineMeta}>{item.meta}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyHero} activeOpacity={0.9} onPress={() => setPosting(true)}>
            <View style={styles.heroEyebrowRow}>
              <KumihimoRule width={18} />
              <Text style={styles.heroEyebrowText}>　あなたの演舞</Text>
            </View>
            <IconUchiwa size={30} color={colors.gold} />
            <Text style={styles.emptyHeroTitle}>まだ演舞を投稿していません</Text>
            <Text style={styles.emptyHeroSub}>撮った演舞を投稿すると、ここに表示されます</Text>
            <View style={styles.emptyHeroBtn}>
              <Text style={styles.emptyHeroBtnText}>演舞を投稿する</Text>
            </View>
          </TouchableOpacity>
        )}

        <AwaDivider width={SCREEN_W} style={styles.divider} />

        {/* 先輩からのチャレンジ（横スクロール） */}
        <SectionHeader
          title="先輩からのチャレンジ"
          note="見本(サンプル)です。年長・ベテランの「これ踊ってみよう」。タップでコツが読めます"
          style={styles.sectionAfterDivider}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.masterScroll}
        >
          {challenges.map((c) => {
            const CatIcon = categoryIcon(c.category);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.masterCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Challenge', { id: c.id })}
              >
                <ImageBackground source={{ uri: c.image }} style={styles.masterThumb}>
                  <View style={styles.masterThumbScrim}>
                    <View style={styles.chChipRow}>
                      <View style={styles.chBadge}>
                        <Text style={styles.chBadgeText}>チャレンジ</Text>
                      </View>
                      <View style={styles.catChip}>
                        <CatIcon size={11} color={colors.goldBright} />
                        <Text style={styles.catChipText}>{c.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                </ImageBackground>
                <View style={styles.masterBody}>
                  <Text style={styles.masterName} numberOfLines={2}>{c.title}</Text>
                  <View style={styles.chPoster}>
                    <RenMon size={16} color={colors.gold}>
                      <Text style={styles.chPosterInitial}>{c.poster.slice(0, 1)}</Text>
                    </RenMon>
                    <Text style={styles.chPosterText} numberOfLines={1}>　{c.poster}／{c.posterRole}</Text>
                  </View>
                  <View style={styles.playSmallBtn}>
                    <IconMakimono size={12} color={colors.gold} />
                    <Text style={styles.playSmallText}>コツを見る・挑戦する</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.dividerWrap}>
          <ChochinGarland width={SCREEN_W} count={5} height={40} sag={10} />
          <AwaDivider width={SCREEN_W} style={{ marginTop: spacing.sm }} />
        </View>

        {/* 交流フィード（旧コミュニティを統合）— 青海波を敷く */}
        <SeigaihaBand width={SCREEN_W} height={16} color={colors.gold} opacity={0.28} style={styles.feedWave} />
        <View style={styles.feedHead}>
          <View style={styles.feedCategoryRow}>
            <IconWagasa size={13} color={colors.gold} />
            <Text style={styles.feedCategory}>　連の広場</Text>
          </View>
          <Text style={styles.feedTitle}>みんなの演舞と門下生の声</Text>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <IconUchiwa size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="演舞・踊り手・連を探す"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedTagRow}
        >
          {feedTags.map((t) => (
            <Chip key={t} label={t} active={feedTag === t} onPress={() => setFeedTag(t)} />
          ))}
        </ScrollView>

        <View style={styles.feedList}>
          {/* 実データ：交流広場に投稿された演舞（新着順。ヒーローに出している自分の最新分は除く） */}
          {feedRealPosts.length > 0 ? (
            <>
              {feedRealPosts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.feedCard}
                  activeOpacity={0.85}
                  onPress={() => openPost(p.id)}
                >
                  <View style={styles.feedThumb}>
                    {p.videoUrl ? (
                      <RenkeiVideo uri={p.videoUrl} style={styles.feedThumbVideo} contentFit="cover" muted />
                    ) : null}
                    <View style={styles.feedCatMark}>
                      <IconEnbuPlay size={12} color={colors.goldBright} />
                    </View>
                    <View style={styles.feedKime}>
                      <Text style={styles.feedKimeText}>
                        {typeof p.score === 'number' ? `極め ${p.score}` : '未採点'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.feedBody}>
                    <Text style={styles.feedCardTitle} numberOfLines={2}>{p.title}</Text>
                    <View style={styles.feedAuthorRow}>
                      <RenMon size={18} color={colors.gold}>
                        <Text style={styles.feedAvatarChar}>{p.authorName.slice(0, 1)}</Text>
                      </RenMon>
                      <Text style={styles.feedMeta} numberOfLines={1}>
                        　{p.authorName}{p.userId && p.userId === uid ? '（あなた）' : ''}
                      </Text>
                    </View>
                    {p.tags.length > 0 ? (
                      <Text style={styles.feedTags} numberOfLines={1}>{p.tags.join('  ')}</Text>
                    ) : null}
                    <View style={styles.feedStats}>
                      <TouchableOpacity
                        style={styles.feedClapBtn}
                        onPress={() => onFeedClap(p.id)}
                        disabled={clapBusyId === p.id}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconNaruko size={13} color={likedMap[p.id] ? colors.aka : colors.gold} />
                        <Text style={[styles.feedStatText, likedMap[p.id] && styles.feedStatTextActive]}>{p.likeCount}</Text>
                      </TouchableOpacity>
                      <View style={{ marginLeft: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
                        <IconMakimono size={13} color={colors.textMuted} />
                        <Text style={styles.feedStatText}>{p.commentCount}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          <View style={styles.sampleDivider}>
            <KumihimoRule width={16} />
            <Text style={styles.sampleDividerText}>　ここから下は見本（サンプル）</Text>
          </View>

          {visibleFeed.length === 0 ? (
            <Text style={styles.emptyText}>この条件の演舞はまだありません。</Text>
          ) : (
            visibleFeed.map((p) => {
              const CatIcon = categoryIcon(p.category);
              return (
              <TouchableOpacity
                key={p.id}
                style={styles.feedCard}
                activeOpacity={0.85}
                onPress={() => openEnbu(p.id)}
              >
                <ImageBackground
                  source={{ uri: p.image }}
                  style={styles.feedThumb}
                  imageStyle={{ borderRadius: radius.sm }}
                >
                  <View style={styles.feedCatMark}>
                    <CatIcon size={12} color={colors.goldBright} />
                  </View>
                  <View style={styles.feedKime}>
                    <Text style={styles.feedKimeText}>極め {p.kimeRate}</Text>
                  </View>
                </ImageBackground>
                <View style={styles.feedBody}>
                  <Text style={styles.feedCardTitle} numberOfLines={2}>{p.title}</Text>
                  <View style={styles.feedAuthorRow}>
                    <RenMon size={18} color={colors.gold}>
                      <Text style={styles.feedAvatarChar}>{p.author.slice(0, 1)}</Text>
                    </RenMon>
                    <Text style={styles.feedMeta} numberOfLines={1}>　{p.author}／{p.authorRen}</Text>
                  </View>
                  {p.tags.length > 0 ? (
                    <Text style={styles.feedTags} numberOfLines={1}>{p.tags.join('  ')}</Text>
                  ) : null}
                  <View style={styles.feedStats}>
                    <IconNaruko size={13} color={colors.gold} />
                    <Text style={styles.feedStatText}>{p.claps}</Text>
                    <View style={{ marginLeft: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
                      <IconMakimono size={13} color={colors.textMuted} />
                      <Text style={styles.feedStatText}>{p.comments}</Text>
                    </View>
                    <Text style={styles.feedTime}>・{p.timeAgo}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>

      {/* 演舞を披露する（ダミー投稿） */}
      <Modal visible={posting} transparent animationType="slide" onRequestClose={() => setPosting(false)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>演舞を披露する</Text>
              <TouchableOpacity onPress={() => setPosting(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={colors.gold} />
              </TouchableOpacity>
            </View>
            {videoUri ? (
              <TouchableOpacity
                style={styles.modalPicker}
                onPress={pickVideo}
                activeOpacity={0.85}
                disabled={submitting}
              >
                <RenkeiVideo uri={videoUri} style={styles.modalPickerVideo} contentFit="cover" muted />
                <View style={styles.modalPickerSelected}>
                  <Text style={styles.modalPickerText}>動画を選び直す</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.pickRow}>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={recordVideo}
                  activeOpacity={0.85}
                  disabled={submitting}
                >
                  <IconEnbuPlay size={22} color={colors.gold} />
                  <Text style={styles.pickBtnText}>今すぐ撮る</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={pickVideo}
                  activeOpacity={0.85}
                  disabled={submitting}
                >
                  <IconMakimono size={22} color={colors.gold} />
                  <Text style={styles.pickBtnText}>ライブラリから選ぶ</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.modalPickerHint}>
              初めての演舞でも大丈夫。その場で撮ってすぐ投稿できます。選ばない場合は見本として保存されます。
            </Text>
            {videoUri ? (
              <TouchableOpacity onPress={recordVideo} disabled={submitting} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.reRecordText}>撮り直す</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.modalLabel}>演舞の題</Text>
            <TextInput
              style={styles.modalInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="例：男踊り 基本の足運び"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.modalLabel}>概要（任意）</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={draftDesc}
              onChangeText={setDraftDesc}
              placeholder="どんな演舞か、見てほしい所など"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Text style={styles.modalLabel}>調子・型のしるし</Text>
            <View style={styles.modalTagWrap}>
              {POST_TAG_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={draftTags.includes(t)}
                  onPress={() => toggleDraftTag(t)}
                  style={{ marginBottom: spacing.sm }}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modalSubmit, (!draftTitle.trim() || submitting) && styles.modalSubmitDisabled]}
              onPress={submitPost}
              disabled={!draftTitle.trim() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnGold} />
              ) : (
                <Text style={styles.modalSubmitText}>
                  {videoUri ? '広場へ披露する' : '見本として保存する'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerSide: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.aka,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textOnAka },
  headerCenter: { flex: 1, alignItems: 'center' },
  noren: { backgroundColor: colors.indigoDeep },
  postBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    height: 46,
  },
  postBarText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  logoSub: { ...typography.caption, color: colors.textMuted, fontSize: 9, marginTop: 3 },

  countdownChip: {
    backgroundColor: colors.akaDeep,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  countdownText: { ...typography.metric, color: colors.kinari, fontSize: 10 },
  feedWave: { marginTop: spacing.xs },
  menuPanelLabel: { ...typography.sectionLabel, color: colors.gold },
  menuFilterHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  menuChipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  menuChip: { marginBottom: spacing.sm },

  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.indigo,
    borderBottomWidth: 1,
    borderBottomColor: colors.indigoLine,
  },
  activeFilterText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  activeFilterClear: { ...typography.caption, color: colors.gold, fontWeight: '700' },

  topGarland: { backgroundColor: colors.indigoDeep },

  scrollContent: { paddingBottom: spacing.xl },
  divider: { marginTop: spacing.xxl, marginBottom: spacing.xs },
  dividerWrap: { marginTop: spacing.xxl, marginBottom: spacing.xs },
  sectionAfterDivider: { marginTop: spacing.md },

  hero: { borderBottomWidth: 1, borderBottomColor: colors.indigoLine },
  heroImageWrap: { overflow: 'hidden' },
  heroImage: { flex: 1, backgroundColor: colors.indigo },
  heroVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.indigo },
  // 動画の上には再生ボタンだけを重ねる。見出し・タグ・題名などの文字は
  // 動画に重ねず、下のheroBody(renderHeroInfo)に表示する。
  heroImgGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroGarland: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroTopEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroEyebrowText: { ...typography.sectionLabel, color: colors.gold, letterSpacing: 3 },
  heroPlayWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlayCircle: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroImgFooter: {},
  heroTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: spacing.xs, marginBottom: spacing.sm },
  badgeGap: { marginLeft: spacing.sm },
  heroRen: { ...typography.caption, color: colors.gold, marginBottom: spacing.xs },
  heroName: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20 },
  heroRole: { ...typography.body, color: colors.goldBright },

  heroBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  heroDesc: { ...typography.body, color: colors.textSecondary },
  heroMetrics: { marginTop: spacing.md },
  syncBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
  },
  syncBtnText: { ...typography.button, color: colors.textPrimary, fontWeight: '400' },

  otherMineLabel: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.sm },
  otherMineRow: { paddingRight: spacing.lg },
  otherMineCard: { width: 128, marginRight: spacing.md },
  otherMineThumb: { width: '100%', height: 78, backgroundColor: colors.indigoRaised, borderRadius: radius.sm, overflow: 'hidden' },
  otherMineThumbVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  otherMineTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.sm },
  otherMineMeta: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 2 },

  emptyHero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    backgroundColor: colors.indigo,
    alignItems: 'center',
  },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  emptyHeroTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 16, marginTop: spacing.md },
  emptyHeroSub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  emptyHeroBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  emptyHeroBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 13 },

  masterScroll: { paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingBottom: spacing.xs },
  masterCard: {
    width: 236,
    backgroundColor: colors.indigo,
    marginRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    overflow: 'hidden',
  },
  masterThumb: { width: '100%', height: 128, justifyContent: 'flex-start' },
  masterThumbScrim: { padding: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(11,19,43,0.78)',
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  catChipText: { ...typography.caption, color: colors.goldBright, fontSize: 9, fontWeight: '700', marginLeft: 4 },
  chChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.aka,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  chBadgeText: { ...typography.caption, color: colors.textOnAka, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  chPoster: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, minHeight: 22 },
  chPosterInitial: { ...typography.caption, color: colors.gold, fontSize: 8, fontWeight: '700' },
  chPosterText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  masterBody: { padding: spacing.md },
  masterName: { ...typography.bodyStrong, color: colors.textPrimary, minHeight: 36 },
  masterRen: { ...typography.caption, color: colors.gold, marginTop: 2 },
  masterDesc: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, minHeight: 32 },
  playSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  playSmallText: { ...typography.caption, color: colors.gold, marginLeft: 6 },

  /* --- 交流フィード --- */
  feedHead: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  feedCategoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  feedCategory: { ...typography.sectionLabel, color: colors.gold },
  feedTitle: { ...typography.headingSerif, color: colors.textPrimary },

  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, ...typography.body },

  feedTagRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  feedList: { paddingHorizontal: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  feedCard: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  feedThumb: { width: 92, height: 92, backgroundColor: colors.indigoRaised, justifyContent: 'flex-end', borderRadius: radius.sm, overflow: 'hidden' },
  feedThumbVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sampleDivider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
  sampleDividerText: { ...typography.caption, color: colors.textMuted },
  feedCatMark: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(11,19,43,0.78)',
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: 3,
    borderRadius: radius.sm,
  },
  feedKime: {
    alignSelf: 'flex-start',
    backgroundColor: colors.overlay,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
    margin: 4,
  },
  feedKimeText: { ...typography.caption, color: colors.goldBright, fontSize: 9, fontWeight: '700' },
  feedBody: { flex: 1, marginLeft: spacing.md },
  feedCardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  feedAvatarChar: { ...typography.caption, color: colors.gold, fontSize: 9, fontWeight: '700' },
  feedMeta: { ...typography.caption, color: colors.textMuted, flex: 1 },
  feedTags: { ...typography.caption, color: colors.gold, marginTop: 3 },
  feedStats: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  feedStatText: { ...typography.caption, color: colors.textSecondary, marginLeft: 4 },
  feedClapBtn: { flexDirection: 'row', alignItems: 'center' },
  feedStatTextActive: { color: colors.aka, fontWeight: '700' },
  feedTime: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },

  /* --- 投稿モーダル --- */
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,19,43,0.7)' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  modalPicker: {
    height: 120,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.indigo,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  modalPickerVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalPickerSelected: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  modalPickerText: { ...typography.caption, color: colors.gold, marginTop: spacing.sm },
  modalPickerHint: { ...typography.caption, color: colors.textMuted, fontSize: 10, lineHeight: 15, marginBottom: spacing.md },
  pickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  pickBtn: {
    flex: 1,
    height: 84,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.indigo,
  },
  pickBtnText: { ...typography.caption, color: colors.gold, marginTop: spacing.xs, fontSize: 12 },
  reRecordText: { ...typography.caption, color: colors.gold, textAlign: 'center', marginBottom: spacing.sm, textDecorationLine: 'underline' },
  modalTextarea: { minHeight: 64, textAlignVertical: 'top' },
  modalLabel: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm, marginTop: spacing.sm },
  modalInput: {
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  modalTagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  modalSubmit: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalSubmitDisabled: { opacity: 0.4 },
  modalSubmitText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
});
