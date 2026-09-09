import React, { useState, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { X, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography } from '../theme';
import { SectionHeader, Badge, Chip, MetricRow } from '../components/ui';
import { ChochinGarland, SeigaihaBand, RenMon, KumihimoRule, AwaDivider } from '../components/motifs';
import {
  IconEnbuPlay,
  IconUchiwa,
  IconNaruko,
  IconMakimono,
  IconTenugui,
  IconGeta,
  categoryIcon,
} from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import { RenKeiWordmark } from '../components/Brand';
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

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.min(Math.round(SCREEN_W * 0.64), 320);

export default function HomeScreen({ navigation }: any) {
  const [activeChip, setActiveChip] = useState(filterChips[0]);
  const [feedTag, setFeedTag] = useState(feedTags[0]);
  const [search, setSearch] = useState('');

  // ダミー：投稿はローカル state で保持（自分の投稿 + 交流フィード）
  const [feed, setFeed] = useState<FeedPost[]>([...seedMine, ...seedFeed]);
  const [posting, setPosting] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const openEnbu = (id: string) => navigation.navigate('VideoDetail', { id });

  // 自分が投稿した演舞（新しい順）
  const mine = useMemo(() => feed.filter((p) => p.mine), [feed]);
  const heroPost = mine[0] ?? null;
  const otherMine = mine.slice(1);

  const visibleFeed = useMemo(() => {
    return feed.filter((p) => {
      const tagOk = feedTag === feedTags[0] || p.tags.includes(feedTag);
      const q = search.trim();
      const searchOk =
        !q || p.title.includes(q) || p.author.includes(q) || p.authorRen.includes(q);
      return tagOk && searchOk;
    });
  }, [feed, feedTag, search]);

  const submitPost = () => {
    if (!draftTitle.trim()) return;
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
        description: '投稿したばかりの演舞です。',
        image: awaImage('男踊り', Math.floor(Math.random() * 7)),
        mine: true,
      },
      ...prev,
    ]);
    setPosting(false);
    setDraftTitle('');
    setDraftTags([]);
    setFeedTag(feedTags[0]);
  };

  const toggleDraftTag = (t: string) =>
    setDraftTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <SafeAreaView style={styles.container}>
      <ChochinGarland width={SCREEN_W} count={7} height={44} style={styles.topGarland} />

      {/* ヘッダー：アプリ銘・メニューアイコン */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <RenKeiWordmark size={21} />
          <Text style={styles.logoSub}>阿波・稽古と交流の広場</Text>
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
      <SeigaihaBand
        width={SCREEN_W}
        height={13}
        color={colors.gold}
        opacity={0.4}
        style={styles.headerBand}
      />

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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 自分が投稿した演舞 */}
        {heroPost ? (
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.heroImageWrap}
              activeOpacity={0.92}
              onPress={() => openEnbu(heroPost.id)}
            >
              <ImageBackground source={{ uri: heroPost.image }} style={styles.heroImage}>
                <LinearGradient
                  colors={['rgba(11,19,43,0.55)', 'rgba(11,19,43,0.1)', 'rgba(11,19,43,0.88)']}
                  locations={[0, 0.42, 1]}
                  style={styles.heroImgGrad}
                >
                  <ChochinGarland width={SCREEN_W} count={9} height={46} sag={14} style={styles.heroGarland} />

                  <View style={styles.heroEyebrowTop}>
                    <KumihimoRule width={18} />
                    <Text style={styles.heroEyebrowText}>　あなたの直近の投稿</Text>
                  </View>

                  <View style={styles.heroPlayWrap} pointerEvents="none">
                    <View style={styles.heroPlayCircle}>
                      <IconEnbuPlay size={24} color={colors.textOnGold} />
                    </View>
                  </View>

                  <View style={styles.heroImgFooter}>
                    <View style={styles.heroTopRow}>
                      <Badge label={heroPost.category} tone="aka" />
                      <Badge label={`極め度 ${heroPost.kimeRate}%`} tone="dark" style={styles.badgeGap} />
                      <Badge label={heroPost.timeAgo} tone="outline" style={styles.badgeGap} />
                    </View>
                    <Text style={styles.heroRen}>{heroPost.authorRen}</Text>
                    <Text style={styles.heroName} numberOfLines={2}>{heroPost.title}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>

            <View style={styles.heroBody}>
              {heroPost.description ? (
                <Text style={styles.heroDesc}>{heroPost.description}</Text>
              ) : null}
              <MetricRow
                style={styles.heroMetrics}
                items={[
                  { label: '演舞尺', value: heroPost.duration ?? '--:--' },
                  { label: '拍手', value: `${heroPost.claps}` },
                  { label: '門下生の声', value: `${heroPost.comments}` },
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

              {otherMine.length > 0 ? (
                <>
                  <Text style={styles.otherMineLabel}>ほかのあなたの投稿</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.otherMineRow}
                  >
                    {otherMine.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.otherMineCard}
                        activeOpacity={0.9}
                        onPress={() => openEnbu(p.id)}
                      >
                        <ImageBackground
                          source={{ uri: p.image }}
                          style={styles.otherMineThumb}
                          imageStyle={{ borderRadius: radius.sm }}
                        />
                        <Text style={styles.otherMineTitle} numberOfLines={2}>{p.title}</Text>
                        <Text style={styles.otherMineMeta}>{p.timeAgo}・拍手 {p.claps}</Text>
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
          note="年長・ベテランの「これ踊ってみよう」。タップでコツが読めます"
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

        {/* 交流フィード（旧コミュニティを統合） */}
        <View style={styles.feedHead}>
          <Text style={styles.feedCategory}>連の広場</Text>
          <Text style={styles.feedTitle}>みんなの演舞と門下生の声</Text>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} />
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
      </ScrollView>

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
            <View style={styles.modalPicker}>
              <IconEnbuPlay size={26} color={colors.gold} />
              <Text style={styles.modalPickerText}>演舞の動画を選ぶ（ダミー）</Text>
            </View>
            <Text style={styles.modalLabel}>演舞の題</Text>
            <TextInput
              style={styles.modalInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="例：男踊り 基本の足運び"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.modalLabel}>調子・型のしるし</Text>
            <View style={styles.modalTagWrap}>
              {feedTags.slice(1).map((t) => (
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
              style={[styles.modalSubmit, !draftTitle.trim() && styles.modalSubmitDisabled]}
              onPress={submitPost}
              disabled={!draftTitle.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSubmitText}>広場へ披露する</Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBand: {
    backgroundColor: colors.indigo,
    borderBottomWidth: 1,
    borderBottomColor: colors.indigoLine,
  },
  postBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    height: 46,
  },
  postBarText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  logoRow: { flex: 1 },
  logoSub: { ...typography.caption, color: colors.textMuted, fontSize: 9, marginTop: 2 },
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
  heroImageWrap: { height: HERO_H, overflow: 'hidden' },
  heroImage: { flex: 1, backgroundColor: colors.indigo },
  heroImgGrad: { flex: 1, padding: spacing.lg, paddingBottom: spacing.lg, justifyContent: 'flex-end' },
  heroGarland: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroEyebrowTop: {
    position: 'absolute',
    top: 38,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroEyebrowText: { ...typography.sectionLabel, color: colors.goldBright, letterSpacing: 3 },
  heroPlayWrap: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    bottom: 78,
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
  heroImgFooter: {},
  heroTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: spacing.xs, marginBottom: spacing.sm },
  badgeGap: { marginLeft: spacing.sm },
  heroRen: { ...typography.caption, color: colors.gold, marginBottom: spacing.xs },
  heroName: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 20 },
  heroRole: { ...typography.body, color: colors.goldBright },

  heroBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
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
  otherMineThumb: { width: '100%', height: 78, backgroundColor: colors.indigoRaised },
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
  feedCategory: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.xs },
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
  feedThumb: { width: 92, height: 92, backgroundColor: colors.indigoRaised, justifyContent: 'flex-end' },
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
  },
  modalPickerText: { ...typography.caption, color: colors.gold, marginTop: spacing.sm },
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
