import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../utils/alert';
import * as ImagePicker from 'expo-image-picker';
import { X, Bell } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography } from '../theme';
import { SectionHeader, Badge, Chip, MetricRow } from '../components/ui';
import { ChochinGarland, Noren, SeigaihaBand, RenMon, KumihimoRule, AwaDivider } from '../components/motifs';
import {
  IconEnbuPlay,
  IconUchiwa,
  IconNaruko,
  IconMakimono,
  IconGeta,
  IconWagasa,
  categoryIcon,
} from '../components/awaIcons';
import AppMenu from '../components/AppMenu';
import UserAvatar from '../components/UserAvatar';
import { useUserIcons } from '../hooks/useUserIcons';
import RenkeiVideo from '../components/RenkeiVideo';
import VideoThumbnail from '../components/VideoThumbnail';
import InPageVideoRecorder, { RecordedVideo } from '../components/InPageVideoRecorder';
import { RenKeiWordmark } from '../components/Brand';
import { auth } from '../config/firebaseConfig';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import {
  subscribePosts,
  loadCachedPosts,
  uploadVideoAndPublish,
  publishExistingVideo,
  isLiked,
  toggleLike,
  POST_TAG_OPTIONS,
} from '../repositories/posts';
import { fetchVideo, videoDownloadUrl } from '../repositories/videos';
import type { Post as PostDoc } from '../types/firestore';
import {
  CHALLENGE_CATEGORY_LABEL,
  CHALLENGE_DIFFICULTY_LABEL,
  subscribeChallenges,
} from '../repositories/challenges';
import type { ChallengeDoc } from '../types/firestore';
import { formatAiScore } from '../features/analysis/format';

/* ------------------------------------------------------------------ */
/* 華やか演出：再生ボタンの波紋 / 動く火の粉 / 押下演出 */
/* ------------------------------------------------------------------ */
/** アニメーションをネイティブ側で動かせるか(Webでは使えないので false) */
const ANIM_NATIVE = Platform.OS !== 'web';

/** 再生ボタンの周りに広がる波紋アニメーション */
function PulsePlay({ children }: { children: React.ReactNode }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: ANIM_NATIVE,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);

  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.playWrap} pointerEvents="none">
      <Animated.View
        style={[styles.playCircle, styles.playRing, { opacity, transform: [{ scale }] }]}
      />
      <View style={styles.playCircle}>{children}</View>
    </View>
  );
}

/** 火の粉1粒の設定(横位置・大きさ・動く時間・開始の遅れ・横への流れ・動く高さ・色) */
type SparkProps = {
  x: number;
  size: number;
  dur: number;
  delay: number;
  drift: number;
  height: number;
  color: string;
};

/** 火の粉1粒ぶんのアニメーション(下から上へ漂いながらフェード) */
function Spark({ x, size, dur, delay, drift, height, color }: SparkProps) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;

    const run = (d: number) => {
      v.setValue(0);
      Animated.sequence([
        Animated.delay(d),
        Animated.timing(v, {
          toValue: 1,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: ANIM_NATIVE,
        }),
      ]).start(({ finished }) => {
        if (alive && finished) run(0);
      });
    };

    run(delay);

    return () => {
      alive = false;
      v.stopAnimation();
    };
  }, [v, dur, delay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-10, height] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const opacity = v.interpolate({
    inputRange: [0, 0.12, 0.85, 1],
    outputRange: [0, 0.9, 0.9, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: x,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }],
      }}
    />
  );
}

/** Sparkを複数ランダム配置して重ねる背景レイヤー */
function SparkLayer({ count = 10 }: { count?: number }) {
  const { width, height } = useWindowDimensions();

  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        x: Math.round(Math.random() * Math.max(0, width - 8)),
        size: 3 + Math.round(Math.random() * 2),
        dur: 6500 + Math.round(Math.random() * 4000),
        delay: Math.round(Math.random() * 6000),
        drift: Math.round((Math.random() - 0.5) * 50),
        color: i % 3 === 0 ? colors.goldBright : colors.gold,
      })),
    [count, width],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparks.map(({ key, ...spark }) => (
        <Spark key={key} height={height} {...spark} />
      ))}
    </View>
  );
}

/** ヒーロー画像の下端を背景色へグラデーションで馴染ませる */
function HeroFade({ height = 84 }: { height?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(11,19,43,0)', colors.indigoDeep]}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    />
  );
}

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

// ============================================================
// ヒーロー表示用のデータ型
// 画面上部に表示する「あなたの最新投稿」を扱うための型。
// ============================================================
type HeroLike = {
  category: string;
  kimeRate: number | undefined;
  timeAgo: string;
  authorRen: string;
  title: string;
};

/**
 * 動画の上には再生ボタンだけを重ねる(文字を動画に重ねないでほしいという
 * フィードバックを受け、見出し・タグ・題名などは動画の下(renderHeroInfo)に
 * 移した)。
 */
function renderHeroVideoOverlay() {
  return (
    <PulsePlay>
      <IconEnbuPlay size={24} color={colors.textOnGold} />
    </PulsePlay>
  );
}

/** 動画の下に出す情報: 見出し(あなたの直近の投稿)・本番までの日数・種類と極め度と投稿時期のバッジ・所属・題名 */
function renderHeroInfo(hero: HeroLike, festivalDays: number) {
  return (
    <>
      <View style={styles.heroInfoTopRow}>
        <View style={styles.heroTopEyebrowRow}>
          <KumihimoRule width={18} />
          <Text style={styles.heroEyebrowText}>
            あなたの直近の投稿
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
            label={formatAiScore(hero.kimeRate)}
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

// ============================================================
// Home画面
// 上から「ヘッダー → 投稿バー → ヒーロー(直近の投稿＋本番カウントダウン)
// → 師匠からのチャレンジ → 連の広場(交流フィード)」の順に並べ、
// 最後に投稿モーダルを置いている。
// ============================================================
/** この画面が受け取る値(画面遷移と、稽古手帳から渡される動画IDなど)の型 */
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** フィードの絞り込みタグ。投稿時に選べるタグ(POST_TAG_OPTIONS)と同じものを並べ、名前のずれで絞り込めなくなるのを防ぐ */
const FEED_TAGS: string[] = ['すべて', ...POST_TAG_OPTIONS];

/**
 * ホーム画面(U-01)。交流広場を兼ねる(旧CommunityScreenはここに統合済み)。
 * 自分の最新投稿をヒーローに、その下に交流フィード(実際の投稿)を出す。
 * 投稿モーダルもここで持つ。
 */
export default function HomeScreen({ navigation, route }: Props) {
  // 画面幅に合わせてヒーロー画像の高さを調整。
  // スマホの縦横比が変わってもレイアウトが崩れにくいようにする。
  const { width: SCREEN_W } = useWindowDimensions();
  const HERO_H = Math.min(Math.round(SCREEN_W * 0.64), 320);
  // フィードタグ／検索欄の状態（絞り込みは「みんなの演舞と門下生の声」側に統一）
  const [feedTag, setFeedTag] = useState(FEED_TAGS[0]);
  const [search, setSearch] = useState('');

  // スクロール量を使って、ヘッダーなどの演出を制御するための値、演出には今は使っていない
  const scrollY = useRef(new Animated.Value(0)).current;
  // 阿波おどり本番までの日数。初回表示時に一度だけ計算する。
  const festivalDays = useMemo(() => daysToFestival(), []);

  const [posting, setPosting] = useState(false);
  // Web版の「今すぐ撮る」はOSのカメラアプリに丸投げせず、採点画面と同じ
  // getUserMedia+MediaRecorderでアプリ内完結させる(launchCameraAsyncはWebでは
  // 撮影後にアプリへ戻ってこないことがある。expo-image-picker公式ドキュメント参照)
  const [recording, setRecording] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  // アプリ内録画のblob:URLは、差し替え・投稿後・画面離脱時に解放する(動画Blobが残り続けるのを防ぐ)
  const blobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = blobUrlRef.current;
    if (prev && prev !== videoUri) URL.revokeObjectURL(prev);
    blobUrlRef.current = videoUri && videoUri.startsWith('blob:') ? videoUri : null;
  }, [videoUri]);
  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    },
    [],
  );
  // 稽古手帳(VideoList)の「交流広場へ投稿」から来た、既にStorageにある練習動画のID。
  // 設定されている間はsubmitPostが再アップロードせずpublishExistingVideoを使う
  const [existingVideoId, setExistingVideoId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 稽古手帳から shareVideoId 付きで来たとき、その練習動画を投稿フォームに
  // 入れてモーダルを開く(交流広場はこのHomeに統合されているため)
  useEffect(() => {
    const shareVideoId = route.params?.shareVideoId;
    if (!shareVideoId) return;
    let cancelled = false;
    (async () => {
      try {
        const video = await fetchVideo(shareVideoId);
        if (cancelled) return;
        if (!video?.storagePath && !video?.downloadUrl) {
          Alert.alert('動画がありません', 'この練習は動画を保存していないため投稿できません');
          return;
        }
        const url = video.downloadUrl ?? (await videoDownloadUrl(video.storagePath!));
        if (cancelled) return;
        setVideoUri(url);
        setExistingVideoId(shareVideoId);
        setPosting(true);
      } catch (e) {
        console.error('練習動画の取得に失敗しました', e);
        Alert.alert('エラー', '練習動画の取得に失敗しました');
      } finally {
        navigation.setParams({ shareVideoId: undefined });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params?.shareVideoId, navigation]);

  // 実データ：交流広場の投稿（posts）を購読
  // チャレンジへの挑戦として投稿されたもの(challengeIdあり)は、お題の詳細にだけ出すので除く
  const [realPosts, setRealPosts] = useState<PostDoc[]>([]);
  const gotLive = useRef(false);
  useEffect(() => {
    const communityOnly = (posts: PostDoc[]) => posts.filter((p) => !p.challengeId);
    // まず前回セッションの保存分を即表示（Firestore 応答前・オフラインでも残る）
    loadCachedPosts().then((cached) => {
      if (!gotLive.current && cached.length) setRealPosts(communityOnly(cached));
    });
    const unsub = subscribePosts(
      (posts) => {
        gotLive.current = true;
        setRealPosts(communityOnly(posts));
      },
      (e) => console.warn('subscribePosts', e),
    );
    return unsub;
  }, []);

  const uid = auth.currentUser?.uid;

  // 未読通知の数をリアルタイム購読する(ヘッダーのベルに数字を出す)
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return subscribeUnreadNotificationCount(uid, setUnreadCount, () => undefined);
  }, [uid]);

  // 連の管理者が出題した「師匠からのチャレンジ」(実データ)。見本より前に並べる
  const [realChallenges, setRealChallenges] = useState<ChallengeDoc[]>([]);
  useEffect(() => {
    return subscribeChallenges(setRealChallenges, (e) => console.warn('subscribeChallenges', e));
  }, []);

  // 実際の投稿の詳細画面を開く
  const openPost = (postId: string) => navigation.navigate('VideoDetail', { postId });

  // 自分が投稿した演舞。最新の1件をヒーローに据える。
  const myRealPosts = useMemo(
    () => realPosts.filter((p) => p.userId && p.userId === uid),
    [realPosts, uid],
  );
  const realHero = myRealPosts[0] ?? null;
  // フィード一覧(みんなの演舞)には、ヒーローに出している自分の最新投稿も含めて全件出す。
  // 以前は重複を避けて除いていたが、見本を無くしたため投稿が1件だけだと一覧が空に見えていた
  const feedRealPosts = realPosts;
  // フィードの投稿者のプロフィールアイコン(uid → 画像URL。無ければ頭文字を出す)
  const userIcons = useUserIcons([...feedRealPosts.map((p) => p.userId), ...realChallenges.map((c) => c.createdBy)]);

  // フィード上で直接「拍手」できるように、表示中の投稿の自分のいいね状態を持つ
  // （数そのものはsubscribePostsのライブ購読が反映するので、ここではliked表示だけ管理する）。
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [clapBusyId, setClapBusyId] = useState<string | null>(null);
  const [clapBurstId, setClapBurstId] = useState<string | null>(null);
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

  /** フィード上の拍手(いいね)ボタン。楽観的にアイコンを切り替え、失敗したら戻す */
  const onFeedClap = async (postId: string) => {
    if (clapBusyId) return;
    const currentlyLiked = !!likedMap[postId];
    setClapBusyId(postId);
    setLikedMap((m) => ({ ...m, [postId]: !currentlyLiked }));
    if (!currentlyLiked) {
      setClapBurstId(postId);
      setTimeout(() => setClapBurstId((current) => current === postId ? null : current), 650);
    }
    try {
      await toggleLike(postId, currentlyLiked);
    } catch {
      setLikedMap((m) => ({ ...m, [postId]: currentlyLiked }));
      Alert.alert('エラー', '拍手の送信に失敗しました');
    } finally {
      setClapBusyId(null);
    }
  };

  // ヒーローの下の横並び：自分の投稿（ヒーローに出している最新の1件以外）
  const otherMineItems = useMemo(
    () =>
      myRealPosts
        .filter((p) => p.id !== realHero?.id)
        .map((p) => ({
          key: p.id,
          kind: 'real' as const,
          videoUrl: p.videoUrl,
          title: p.title,
          meta: `あなたの投稿・拍手 ${p.likeCount}`,
          onPress: () => openPost(p.id),
        })),
    [myRealPosts, realHero],
  );

  // ヒーローに出す内容。自分の投稿がなければ null(投稿をうながすカードを出す)
  const hero = realHero
    ? {
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
    : null;

  // 交流フィードの投稿を、選んだタグと検索キーワード(題名・投稿者)で絞り込む
  const visibleRealPosts = useMemo(() => {
    return feedRealPosts.filter((p) => {
      const tagOk = feedTag === FEED_TAGS[0] || p.tags.includes(feedTag);
      const q = search.trim();
      const searchOk = !q || p.title.includes(q) || p.authorName.includes(q);
      return tagOk && searchOk;
    });
  }, [feedRealPosts, feedTag, search]);

  /** 投稿フォームの入力内容を空に戻す */
  const resetDraft = () => {
    setDraftTitle('');
    setDraftDesc('');
    setDraftTags([]);
    setVideoUri(null);
    setExistingVideoId(null);
  };

  /** 投稿モーダルの「ライブラリから選ぶ」。写真ライブラリから動画を選ぶ */
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
    if (!res.canceled && res.assets?.[0]?.uri) {
      setVideoUri(res.assets[0].uri);
      setExistingVideoId(null);
    }
  };

  // 初心者サポート：見てほしい演舞をその場で撮って、そのまま解析・投稿に回せるように。
  // Web版はOSカメラアプリへの丸投げ(launchCameraAsync)をやめ、採点画面と同じ
  // getUserMedia+MediaRecorderでアプリ内完結の録画モーダルを開く
  const recordVideo = async () => {
    if (Platform.OS === 'web') {
      setRecording(true);
      return;
    }
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
    if (!res.canceled && res.assets?.[0]?.uri) {
      setVideoUri(res.assets[0].uri);
      setExistingVideoId(null);
    }
  };

  const onRecordedInPage = (media: RecordedVideo) => {
    setVideoUri(URL.createObjectURL(media.blob));
    setExistingVideoId(null);
    setRecording(false);
  };

  /** 投稿モーダルの送信。選んだ動画を交流広場へ公開する(動画が無いと送れない) */
  const submitPost = async () => {
    if (!draftTitle.trim() || !videoUri || submitting) return;

    if (!auth.currentUser) {
      Alert.alert('ログインが必要です', '投稿するにはログインしてください。');
      return;
    }
    setSubmitting(true);
    try {
      // 稽古手帳から来た練習動画は既にStorageにあるため再アップロードしない
      if (existingVideoId) {
        await publishExistingVideo({
          videoUrl: videoUri,
          title: draftTitle,
          description: draftDesc,
          tags: draftTags,
          videoId: existingVideoId,
        });
      } else {
        await uploadVideoAndPublish({
          uri: videoUri,
          title: draftTitle,
          description: draftDesc,
          tags: draftTags,
        });
      }
      setPosting(false);
      resetDraft();
      setFeedTag(FEED_TAGS[0]);
    } catch (e: any) {
      Alert.alert('投稿に失敗しました', e?.message ?? '時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  /** 投稿フォームのタグを付け外しする */
  const toggleDraftTag = (t: string) =>
    setDraftTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <SafeAreaView style={styles.container}>
      {/* 画面全体に漂う火の粉と、上部に吊るす提灯の飾り */}
      <View style={styles.globalAtmosphere} pointerEvents="none">
        <SparkLayer count={14} />
      </View>
      <Animated.View style={styles.garlandMotion}>
        <ChochinGarland width={SCREEN_W} count={7} height={44} style={styles.topGarland} />
      </Animated.View>

      {/* ヘッダー：藍染めの暖簾風。アプリ銘を中央に */}
      <View style={styles.header}>
        {/* 通知ベル。未読があれば右上に件数を出す。タップで通知一覧へ */}
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
        {/* 中央のロゴと副題 */}
        <View style={styles.headerCenter}>
          <RenKeiWordmark size={21} />
          <Text style={styles.logoSub}>稽古と交流の広場</Text>
        </View>
        <AppMenu />
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

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* 自分が投稿した演舞(最新の1件を動画で大きく見せる) */}
        {hero ? (
          <View style={styles.hero}>
            <TouchableOpacity
              style={[styles.heroImageWrap, { height: HERO_H }]}
              activeOpacity={0.92}
              onPress={hero.onPress}
            >
              <View style={styles.heroImage}>
                  <RenkeiVideo uri={hero.videoUrl} style={styles.heroVideo} contentFit="cover" muted autoPlay loop />
                  <View style={styles.heroLightLayer} pointerEvents="none">
                    <SparkLayer count={6} />
                  </View>
                  <HeroFade height={88} />
                  <View style={styles.heroImgGrad}>{renderHeroVideoOverlay()}</View>
                </View>
            </TouchableOpacity>

            {/* ヒーローの下側: 投稿の情報・説明・演舞尺/拍手/声の数 */}
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
              {/* 「手本と並べて撮り直す」ボタン(自主稽古の画面へ) */}
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={() => navigation.navigate('Scoring')}
                activeOpacity={0.85}
              >
                <IconGeta size={15} color={colors.textPrimary} />
                <Text style={styles.syncBtnText}>　手本と並べて撮り直す</Text>
              </TouchableOpacity>

              {/* ヒーロー以外の自分の投稿を横スクロールで並べる */}
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
                        <View style={styles.otherMineThumb}>
                          <VideoThumbnail uri={item.videoUrl} style={styles.otherMineThumbVideo} />
                        </View>
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
          // まだ投稿がないときは、投稿をうながすカードを出す(タップで投稿フォームを開く)
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

        {/* 師匠からのチャレンジ（横スクロール） */}
        <SectionHeader
          title="師匠からのチャレンジ"
          note="連の師匠からの「これ踊ってみよう」。タップでコツが読めます"
          style={styles.sectionAfterDivider}
        />
        {/* まだ出題が無いときは案内だけ出す */}
        {realChallenges.length === 0 ? (
          <Text style={styles.noChallengeText}>まだお題はありません。連の管理者が「連の管理」から出題できます。</Text>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.masterScroll}
        >
          {/* 実データ: 連の管理者が出題したお題(新しい順)。お手本動画があればその動画を、
              無ければ無地の枠に踊りの種類のアイコンを出す */}
          {realChallenges.map((c) => {
            const CatIcon = categoryIcon(CHALLENGE_CATEGORY_LABEL[c.category]);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.masterCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Challenge', { challengeId: c.id })}
              >
                <View style={[styles.masterThumb, styles.masterThumbPlain]}>
                  {c.videoUrl ? (
                    <VideoThumbnail uri={c.videoUrl} style={styles.masterThumbVideo} />
                  ) : null}
                  <View style={styles.masterThumbScrim}>
                    <View style={styles.chChipRow}>
                      <View style={styles.chBadge}>
                        <Text style={styles.chBadgeText}>チャレンジ</Text>
                      </View>
                      <View style={styles.catChip}>
                        <CatIcon size={11} color={colors.goldBright} />
                        <Text style={styles.catChipText}>{CHALLENGE_DIFFICULTY_LABEL[c.difficulty]}</Text>
                      </View>
                      {c.videoUrl ? (
                        <View style={styles.catChip}>
                          <Text style={[styles.catChipText, { marginLeft: 0 }]}>お手本動画</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {c.videoUrl ? null : (
                    <View style={styles.masterPlainIcon} pointerEvents="none">
                      <CatIcon size={44} color={colors.gold} />
                    </View>
                  )}
                </View>
                {/* お題の題名・出題者(連の名前と肩書き)・「コツを見る・挑戦する」 */}
                <View style={styles.masterBody}>
                  <Text style={styles.masterName} numberOfLines={2}>{c.title}</Text>
                  <View style={styles.chPoster}>
                    <UserAvatar size={16} name={c.posterName} iconUrl={userIcons[c.createdBy]} charStyle={styles.chPosterInitial} />
                    <Text style={styles.chPosterText} numberOfLines={1}>
                      　{c.posterName}／{[c.renName, c.posterRole].filter(Boolean).join(' ')}
                    </Text>
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

        {/* チャレンジとフィードの間の区切り(提灯と飾り罫) */}
        <View style={styles.dividerWrap}>
          <ChochinGarland width={SCREEN_W} count={5} height={40} sag={10} />
          <AwaDivider width={SCREEN_W} style={{ marginTop: spacing.sm }} />
        </View>

        {/* 交流フィード（旧コミュニティを統合）— 青海波を敷く */}
        <SeigaihaBand width={SCREEN_W} height={16} color={colors.gold} opacity={0.28} style={styles.feedWave} />
        {/* 舞台の幕のような飾り線 */}
        <View style={styles.feedStageTop} pointerEvents="none">
          <Text style={styles.stageSparkLeft}>✦</Text>
          <View style={styles.stageRule} />
          <Text style={styles.stageSparkRight}>✦</Text>
        </View>
        {/* フィードの見出し */}
        <View style={styles.feedHead}>
          <View style={styles.feedCategoryRow}>
            <IconWagasa size={13} color={colors.gold} />
            <Text style={styles.feedCategory}>　連の広場</Text>
          </View>
          <Text style={styles.feedTitle}>みんなの演舞と門下生の声</Text>
        </View>

        {/* フィードの検索欄 */}
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

        {/* フィードのタグの絞り込みチップ(横スクロール) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedTagRow}
        >
          {FEED_TAGS.map((t) => (
            <Chip key={t} label={t} active={feedTag === t} onPress={() => setFeedTag(t)} />
          ))}
        </ScrollView>

        <View style={styles.feedList}>
          {/* 交流広場に投稿された演舞(新着順。自分の投稿も含む)。
              該当する投稿がなければ案内文を出す */}
          {visibleRealPosts.length > 0 ? (
            <>
              {visibleRealPosts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.feedCard}
                  activeOpacity={0.85}
                  onPress={() => openPost(p.id)}
                >
                  {/* 左: 動画のサムネイルと、種類のアイコン・極め度の小さな表示 */}
                  <View style={styles.feedThumb}>
                    {p.videoUrl ? (
                      <VideoThumbnail uri={p.videoUrl} style={styles.feedThumbVideo} />
                    ) : null}
                    <View style={styles.feedCatMark}>
                      <IconEnbuPlay size={12} color={colors.goldBright} />
                    </View>
                    <View style={styles.feedKime}>
                      <Text style={styles.feedKimeText}>
                        {formatAiScore(p.score)}
                      </Text>
                    </View >
                  </View >
                  {/* 右: 題名・投稿者(自分なら「あなた」)・タグ・拍手とコメントの数 */}
                  <View style={styles.feedBody}>
                    <Text style={styles.feedCardTitle} numberOfLines={2}>{p.title}</Text>
                    <View style={styles.feedAuthorRow}>
                      <UserAvatar size={18} name={p.authorName} iconUrl={userIcons[p.userId]} charStyle={styles.feedAvatarChar} />
                      <Text style={styles.feedMeta} numberOfLines={1}>
                        {p.authorName}{p.userId && p.userId === uid ? '（あなた）' : ''}
                      </Text>
                    </View>
                    {p.tags.length > 0 ? (
                      <Text style={styles.feedTags} numberOfLines={1}>{p.tags.join('  ')}</Text>
                    ) : null}
                    {/* 拍手ボタン(押すと朱色になり、金色の星が弾ける)とコメントの数 */}
                    <View style={styles.feedStats}>
                      <TouchableOpacity
                        style={styles.feedClapBtn}
                        onPress={() => onFeedClap(p.id)}
                        disabled={clapBusyId === p.id}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconNaruko size={13} color={likedMap[p.id] ? colors.aka : colors.gold} />
                        <Text style={[styles.feedStatText, likedMap[p.id] && styles.feedStatTextActive]}>{p.likeCount}</Text>
                        {clapBurstId === p.id ? (
                          <View style={styles.clapBurst} pointerEvents="none">
                            <Text style={styles.clapBurstText}>✦</Text>
                            <Text style={[styles.clapBurstText, styles.clapBurstText2]}>✦</Text>
                            <Text style={[styles.clapBurstText, styles.clapBurstText3]}>✦</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                      <View style={{ marginLeft: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
                        <IconMakimono size={13} color={colors.textMuted} />
                        <Text style={styles.feedStatText}>{p.commentCount}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity >
              ))
              }
            </>
          ) : (
            <Text style={styles.emptyText}>この条件の演舞はまだありません。</Text>
          )}
        </View >

        <View style={{ height: 32 }} />
      </Animated.ScrollView >

      {/* 演舞を披露する(交流広場への投稿) */}
      < Modal visible={posting} transparent animationType="slide" onRequestClose={() => setPosting(false)}>
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
            {/* 動画を選んでいればその動画(タップで選び直す)、なければ「今すぐ撮る」「ライブラリから選ぶ」 */}
            {videoUri ? (
              <TouchableOpacity
                style={styles.modalPicker}
                onPress={pickVideo}
                activeOpacity={0.85}
                disabled={submitting}
              >
                {/* 縦長の動画でも全体が見えるよう、枠に収めて(contain)出す。場面は一覧のサムネイルと同じ(2秒付近) */}
                <View style={styles.modalPickerPreview}>
                  <VideoThumbnail uri={videoUri} contentFit="contain" style={styles.modalPickerVideo} />
                </View>
                <View style={styles.modalPickerSide}>
                  <Text style={styles.modalPickerText}>動画を選び直す</Text>
                  <TouchableOpacity onPress={recordVideo} disabled={submitting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.reRecordText}>撮り直す</Text>
                  </TouchableOpacity>
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
            {/* 撮影・選択の案内と、撮り直すリンク */}
            <Text style={styles.modalPickerHint}>
              初めての演舞でも大丈夫。その場で撮ってすぐ投稿できます。
            </Text>
            {/* 題名(必須)・概要・タグの入力 */}
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
            {/* タグのチップ(押すたびに付け外し) */}
            <View style={styles.modalTagWrap}>
              {POST_TAG_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={draftTags.includes(t)}
                  onPress={() => toggleDraftTag(t)}
                  compact
                  style={{ marginBottom: spacing.sm }}
                />
              ))}
            </View>
            {/* 送信ボタン。動画を選び、題名を入れるまで押せない。送信中も押せない */}
            <TouchableOpacity
              style={[styles.modalSubmit, (!draftTitle.trim() || !videoUri || submitting) && styles.modalSubmitDisabled]}
              onPress={submitPost}
              disabled={!draftTitle.trim() || !videoUri || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnGold} />
              ) : (
                <Text style={styles.modalSubmitText}>
                  {videoUri ? '広場へ披露する' : '動画を選んでください'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal >

      <InPageVideoRecorder
        visible={recording}
        onCancel={() => setRecording(false)}
        onDone={onRecordedInPage}
      />
    </SafeAreaView >
  );
}

// ============================================================
// Home画面のスタイル
// UI本体とは分離して、見た目の調整をここにまとめる。
// ============================================================
const styles = StyleSheet.create({

  /* --- 華やか演出 --- */
  // 画面全体に重ねる火の粉のレイヤー(操作の邪魔をしないよう一番下で、少し薄くする)
  globalAtmosphere: {
    ...{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    zIndex: 0,
    opacity: 0.75,
  },
  // 上部の提灯の飾りを、火の粉より手前に出す
  garlandMotion: {
    zIndex: 2,
  },
  // 再生ボタン(金色の丸)と、そのまわりに広がる波紋の輪
  playWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: colors.goldBright,
    backgroundColor: 'transparent',
  },
  // ヒーロー画像の上に重ねる光の演出のレイヤー(はみ出した光は隠す)
  heroLightLayer: {
    ...{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    overflow: 'hidden',
  },
  // 斜めに走る光の帯
  shine: {
    position: 'absolute',
    top: -100,
    bottom: -100,
    width: 70,
    backgroundColor: 'rgba(255,239,170,0.10)',
  },
  // チャレンジカードの写真下端に添える飾り(点と線)
  // フィード見出しの上の飾り線(左右に星)
  feedStageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  stageRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.35,
  },
  stageSparkLeft: {
    color: colors.goldBright,
    fontSize: 11,
    marginRight: spacing.sm,
  },
  stageSparkRight: {
    color: colors.goldBright,
    fontSize: 11,
    marginLeft: spacing.sm,
  },
  // 拍手したときに弾ける金色の星(3つを少しずつずらして飛ばす)
  clapBurst: {
    position: 'absolute',
    left: 6,
    top: -10,
    width: 30,
    height: 30,
  },
  clapBurstText: {
    position: 'absolute',
    color: colors.goldBright,
    fontSize: 12,
    fontWeight: '700',
    left: 10,
    top: 0,
  },
  clapBurstText2: {
    left: 0,
    top: 7,
    fontSize: 9,
  },
  clapBurstText3: {
    left: 19,
    top: 8,
    fontSize: 9,
  },

  container: { flex: 1, backgroundColor: colors.indigoDeep },

  // 画面最上部のヘッダー。通知ベル・ロゴ・メニューを横一列に並べる
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // ヘッダー左のベルの置き場と、未読数のバッジ(朱色の丸)
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
  // ヘッダー中央のロゴと、その下の暖簾の飾り
  headerCenter: { flex: 1, alignItems: 'center' },
  noren: { backgroundColor: colors.indigoDeep },
  // 「演舞を披露する」の金色の帯ボタン
  postBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    height: 46,
  },
  postBarText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  logoSub: { ...typography.caption, color: colors.textMuted, fontSize: 9, marginTop: 3 },

  // 「阿波おどり本番まで あと◯日」のチップ
  countdownChip: {
    backgroundColor: colors.akaDeep,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  countdownText: { ...typography.metric, color: colors.kinari, fontSize: 10 },
  feedWave: { marginTop: spacing.xs },

  // 上部の提灯の飾りの背景
  topGarland: { backgroundColor: colors.indigoDeep },

  // スクロール部分の下の余白と、区切りの上下の余白
  scrollContent: { paddingBottom: spacing.xl },
  divider: { marginTop: spacing.xxl, marginBottom: spacing.xs },
  dividerWrap: { marginTop: spacing.xxl, marginBottom: spacing.xs },
  sectionAfterDivider: { marginTop: spacing.md },

  // 画面上部の大きな「ヒーロー」エリア(自分の最新投稿を大きく見せる)
  hero: { borderBottomWidth: 1, borderBottomColor: colors.indigoLine },
  // ヒーローの動画・画像の枠と、その上の再生ボタンの置き場
  heroImageWrap: { overflow: 'hidden' },
  heroImage: { flex: 1, backgroundColor: colors.indigo },
  // Web版の<video>は上下左右0の指定だけでは伸びず元の大きさで描かれる(拡大されたように見える)ため、幅・高さを100%と明示する
  heroVideo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: colors.indigo },
  // 動画の上には再生ボタンだけを重ねる。見出し・タグ・題名などの文字は
  // 動画に重ねず、下のheroBody(renderHeroInfo)に表示する。
  heroImgGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroGarland: { position: 'absolute', top: 0, left: 0, right: 0 },
  // ヒーローの情報: 見出しの行・本番までの日数の行・バッジの行・所属・題名
  heroTopEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroEyebrowText: { ...typography.sectionLabel, color: colors.gold, letterSpacing: 3 },
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

  // ヒーローの下側の余白と、説明文・数字の枠
  heroBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  heroDesc: { ...typography.body, color: colors.textSecondary },
  heroMetrics: { marginTop: spacing.md },
  // 「手本と並べて撮り直す」ボタン(枠線)
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

  // 「ほかのあなたの投稿」の見出しと、横に並べる小さなカード(サムネイル・題名・情報)
  otherMineLabel: { ...typography.sectionLabel, color: colors.gold, marginTop: spacing.xl, marginBottom: spacing.sm },
  otherMineRow: { paddingRight: spacing.lg },
  otherMineCard: { width: 128, marginRight: spacing.md },
  otherMineThumb: { width: '100%', height: 78, backgroundColor: colors.indigoRaised, borderRadius: radius.sm, overflow: 'hidden' },
  otherMineThumbVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  otherMineTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.sm },
  otherMineMeta: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 2 },

  // まだ投稿がないときのカード(中央に案内文と金色のボタン)
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

  // 「師匠からのチャレンジ」の横スクロールと、1件分のカード
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
  // お題が1件も無いときの案内文
  noChallengeText: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  // 実データのお題は写真が無いので、無地の枠の中央に踊りの種類のアイコンを置く
  masterThumbPlain: { backgroundColor: colors.indigoRaised, overflow: 'hidden' },
  // お手本動画のサムネイル(VideoThumbnail)を枠いっぱいに重ねる
  masterThumbVideo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  masterPlainIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // 写真に重ねる難易度のチップと「チャレンジ」のバッジ(朱色)
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
  // 出題者の行(頭文字の紋・名前と役職)
  chPoster: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, minHeight: 22 },
  chPosterInitial: { ...typography.caption, color: colors.gold, fontSize: 8, fontWeight: '700' },
  chPosterText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  // カード下側の題名など
  masterBody: { padding: spacing.md },
  masterName: { ...typography.bodyStrong, color: colors.textPrimary, minHeight: 36 },
  masterRen: { ...typography.caption, color: colors.gold, marginTop: 2 },
  masterDesc: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, minHeight: 32 },
  // 「コツを見る・挑戦する」の小さなボタン
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
  // フィードの見出し(「連の広場」と題)
  feedHead: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  feedCategoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  feedCategory: { ...typography.sectionLabel, color: colors.gold },
  feedTitle: { ...typography.headingSerif, color: colors.textPrimary },

  // フィードの検索欄
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

  // タグの絞り込みチップの並び
  feedTagRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  // フィードの一覧と、0件のときの案内文
  feedList: { paddingHorizontal: spacing.lg },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  // フィード1件分のカード(左にサムネイル、右に情報)
  feedCard: {
    flexDirection: 'row',
    backgroundColor: colors.indigo,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // サムネイルの枠と動画
  feedThumb: { width: 92, height: 92, backgroundColor: colors.indigoRaised, justifyContent: 'flex-end', borderRadius: radius.sm, overflow: 'hidden' },
  feedThumbVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // サムネイルに重ねる種類のアイコン(左上)と極め度(左下)
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
  // カード右側: 題名・投稿者の行・タグ・拍手とコメントの数(拍手済みは朱色)
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

  /* --- 投稿モーダル ：選んだ動画を Firestore/Storage へ公開する --- */
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,19,43,0.7)' },
  modalCard: {
    backgroundColor: colors.indigoDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  // 選んだ動画の表示枠と「動画を選び直す」の表示、選ばないときの案内文
  modalPicker: {
    height: 200,
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  // 左: 動画の確認枠(縦長でも横長でも全体が収まる正方形)。右: 説明と「動画を選び直す」
  modalPickerPreview: { width: 180, height: '100%', backgroundColor: colors.indigoRaised },
  modalPickerVideo: { width: '100%', height: '100%' },
  modalPickerSide: { flex: 1, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center' },
  modalPickerText: { ...typography.caption, color: colors.gold, marginTop: spacing.sm },
  modalPickerHint: { ...typography.caption, color: colors.textMuted, fontSize: 10, lineHeight: 15, marginBottom: spacing.md },
  // 「今すぐ撮る」「ライブラリから選ぶ」のボタン(金色の枠)と「撮り直す」のリンク
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
  reRecordText: { ...typography.caption, color: colors.gold, textAlign: 'center', marginTop: spacing.md, textDecorationLine: 'underline' },
  // 入力欄(概要は複数行)と見出し(金色)
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
  // タグのチップの並びと、送信ボタン(金色。押せないときは薄くする)
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
