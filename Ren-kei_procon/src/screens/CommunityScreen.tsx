import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Modal, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Play, Heart, MessageSquare, Plus, Search, Video as VideoIcon, X, ChevronLeft, Send, Award, User } from 'lucide-react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { formatAiScore, formatAiScoreShort } from '../features/analysis/format';
import { fetchVideo, videoDownloadUrl } from '../repositories/videos';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { colors, spacing, radius, typography } from '../theme';

import { auth } from '../config/firebaseConfig';
import {
  subscribePosts,
  subscribePostComments,
  addPostComment,
  fetchPost,
  likePost,
  uploadPostVideo,
  publishPost,
} from '../repositories/posts';
import { Post, PostComment } from '../types/firestore';
import { useAdminRens } from '../hooks/useAdminRens';
import BottomNav from '../components/BottomNav';

const { width } = Dimensions.get('window');
const TAG_OPTIONS = ['#男踊り', '#女踊り', '#初心者歓迎', '#足の運び', '#鳥追い笠', '#腰落とし', '#2拍子', '#ちびっこ踊り'];

export default function CommunityScreen() {
  // TODO: NativeStackNavigationProp<RootStackParamList, 'Community'>へ置き換える(docs/rules/coding.md 2章)
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Community'>>();
  // U-03(解析結果)から「コミュニティへ投稿」で来た場合の練習動画
  const shareVideoId = route.params?.shareVideoId;
  // 通知(type:'comment')タップで来た場合、直接開く投稿(#44)
  const openPostId = route.params?.openPostId;
  const [shareVideoUrl, setShareVideoUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState('すべて');

  // 投稿用
  const [postTitle, setPostTitle] = useState('');
  const [postVideoUri, setPostVideoUri] = useState<string | null>(null);
  const [postTags, setPostTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return subscribePosts(
      (list) => {
        setPosts(list);
        setLoading(false);
      },
      (error) => {
        console.error('投稿一覧の取得に失敗しました', error);
        setLoading(false);
        Alert.alert('エラー', '投稿一覧の取得に失敗しました。通信環境を確認して画面を開き直してください');
      }
    );
  }, []);

  // 練習動画から来たときは、その動画を投稿フォームに入れてモーダルを開く
  useEffect(() => {
    if (!shareVideoId) return;
    let cancelled = false;
    (async () => {
      try {
        const video = await fetchVideo(shareVideoId);
        if (!video?.storagePath) {
          Alert.alert('動画がありません', 'この練習は動画を保存していないため投稿できません');
          return;
        }
        const url = await videoDownloadUrl(video.storagePath);
        if (cancelled) return;
        setShareVideoUrl(url);
        setPostVideoUri(url);
        setIsPostModalOpen(true);
      } catch (e) {
        console.error('練習動画の取得に失敗しました', e);
      }
    })();
    return () => { cancelled = true; };
  }, [shareVideoId]);

  // 通知タップで来たとき、該当投稿の詳細を直接開く。削除済みなら開かず
  // アラートのみ出す(通知一覧側でも遷移前にフォールバックしているが、
  // それとは別経路でこの画面へ直接来た場合にも同じ挙動にする)。
  useEffect(() => {
    if (!openPostId) return;
    let cancelled = false;
    (async () => {
      try {
        const post = await fetchPost(openPostId);
        if (cancelled) return;
        if (post) {
          setSelectedPost(post);
        } else {
          Alert.alert('投稿が見つかりません', 'この投稿は削除された可能性があります');
        }
      } catch (e) {
        console.error('通知からの投稿取得に失敗しました', e);
      }
    })();
    return () => { cancelled = true; };
  }, [openPostId]);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setPostVideoUri(result.assets[0].uri);
  };

  const handlePost = async () => {
    if (!postVideoUri || !postTitle) return Alert.alert("エラー", "動画とタイトルを入力してください");
    setIsUploading(true);
    try {
      // 練習動画(videos)から来た場合は既に Storage にあるので再アップロードしない
      const fromPractice = shareVideoId !== undefined && postVideoUri === shareVideoUrl;
      let videoUrl = postVideoUri;
      if (!fromPractice) {
        const res = await fetch(postVideoUri);
        const blob = await res.blob();
        videoUrl = await uploadPostVideo(blob);
      }

      const currentUser = auth.currentUser;
      const authorName = currentUser?.email?.split('@')[0] || "匿名踊り子";

      // スコア・カウンタの初期化はクライアントで改ざんできないよう
      // Cloud Functions(publishPost)側で行う。videoId を渡すと AI 採点の結果が投稿に載る
      await publishPost({
        title: postTitle, authorName, videoUrl, tags: postTags,
        ...(fromPractice ? { videoId: shareVideoId } : {}),
      });
      setIsPostModalOpen(false);
      setPostTitle(''); setPostVideoUri(null); setPostTags([]); setShareVideoUrl(null);
      Alert.alert("成功", "動画を投稿しました！");
    } catch (e) { Alert.alert("失敗", "アップロードに失敗しました"); }
    finally { setIsUploading(false); }
  };

  const filteredPosts = selectedTagFilter === 'すべて' ? posts : posts.filter(p => p.tags?.includes(selectedTagFilter));

  if (selectedPost) {
    return <PostDetailScreen post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNav}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}><Text style={styles.logoText}>連</Text></View>
          <View style={{ marginLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.brandName}>ren-kei</Text>
              <View style={styles.badgeGold}><Text style={styles.badgeGoldText}>阿波踊り交流広場</Text></View>
            </View>
            <Text style={styles.brandSub}>練習動画のAI採点・連の絆を深める広場</Text>
          </View>
        </View>
      </View>

      <ScrollView stickyHeaderIndices={[2]}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>リアルタイム共有</Text></View>
          <View style={styles.heroContentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>阿波踊り 交流広場</Text>
              <Text style={styles.heroSub}>稽古の成果を全国の連に届けよう</Text>
            </View>
            <TouchableOpacity style={styles.heroBtn} onPress={() => setIsPostModalOpen(true)} activeOpacity={0.85}>
              <Plus color={colors.textOnGold} size={19} />
              <Text style={styles.heroBtnText}>動画を披露</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}><Search color={colors.textMuted} size={18} /><TextInput placeholder="検索..." placeholderTextColor={colors.textMuted} style={styles.searchInput} /></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagBar} contentContainerStyle={{ paddingRight: 40 }}>
           {['すべて', ...TAG_OPTIONS].map(t => (
             <TouchableOpacity key={t} onPress={() => setSelectedTagFilter(t)} style={[styles.tag, selectedTagFilter === t && styles.tagActive]} activeOpacity={0.85}>
               <Text style={[styles.tagText, selectedTagFilter === t && styles.tagTextActive]}>{t}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>

        <View style={styles.grid}>
          {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xxl }} /> : filteredPosts.map(p => (
            <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelectedPost(p)} activeOpacity={0.85}>
              <View style={styles.cardMain}>
                <View style={styles.thumbWrapper}>
                  <Video style={StyleSheet.absoluteFill} source={{ uri: p.videoUrl }} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                  <View style={styles.scoreBadgeMini}><Text style={styles.scoreValueMini}>{formatAiScoreShort(p.score)}</Text></View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <View style={styles.authorRow}>
                    <View style={styles.avatarMini}><Text style={styles.avatarTextMini}>阿</Text></View>
                    <Text style={styles.authorName}>{p.authorName}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.statItem}><Heart size={15} color={colors.aka} /><Text style={styles.statText}>{p.likeCount}</Text></View>
                <View style={styles.statItem}><MessageSquare size={15} color={colors.textMuted} /><Text style={styles.statText}>{p.commentCount}</Text></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 投稿モーダル */}
      <Modal visible={isPostModalOpen} animationType="slide" onRequestClose={() => setIsPostModalOpen(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>稽古動画を披露する</Text>
            <TouchableOpacity onPress={() => setIsPostModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={colors.textMuted} size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: spacing.xl }}>
            <TouchableOpacity style={styles.picker} onPress={pickVideo} activeOpacity={0.85}>
              {postVideoUri ? (
                <Video style={StyleSheet.absoluteFill} source={{ uri: postVideoUri }} resizeMode={ResizeMode.CONTAIN} isLooping shouldPlay />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <VideoIcon size={40} color={colors.gold} />
                  <Text style={{ marginTop: spacing.sm, color: colors.gold, fontWeight: '700' }}>動画を選択してください</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.label}>タイトル</Text>
            <TextInput style={styles.input} placeholder="例：男踊り 基本の足運び" placeholderTextColor={colors.textMuted} value={postTitle} onChangeText={setPostTitle} />
            <Text style={styles.label}>タグ設定（#複数選択可）</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xl }}>
              {TAG_OPTIONS.map(t => (
                <TouchableOpacity key={t} onPress={() => postTags.includes(t) ? setPostTags(postTags.filter(x => x !== t)) : setPostTags([...postTags, t])} style={[styles.tag, postTags.includes(t) && styles.tagActive]} activeOpacity={0.85}>
                  <Text style={[styles.tagText, postTags.includes(t) && styles.tagTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]} onPress={handlePost} disabled={isUploading} activeOpacity={0.85}>
              {isUploading ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.submitBtnText}>広場へ披露する</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

// --- 詳細画面 ---
function PostDetailScreen({ post, onBack }: { post: Post, onBack: () => void }) {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'instructor' | 'normal'>('instructor');
  const [text, setText] = useState('');
  const [comments, setComments] = useState<PostComment[]>([]);
  const [sending, setSending] = useState(false);
  const { adminRens } = useAdminRens();
  // 指導者コメント(師匠の教え)は連管理者のみ投稿できる(#31)。複数連の
  // 管理者を兼任している場合は、暫定的に最初の連の管理者として投稿する
  const canPostInstructor = adminRens.length > 0;

  useEffect(() => {
    return subscribePostComments(
      post.id,
      setComments,
      (error) => console.error('コメントの取得に失敗しました', error)
    );
  }, [post.id]);

  const onSend = async () => {
    if (!text.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (tab === 'instructor' && !canPostInstructor) return;
    const userName = currentUser.email?.split('@')[0] || "匿名";

    setSending(true);
    try {
      // commentCountはCloud Functionsトリガ(onCommentWrite)が
      // count()集計で自動更新するため、ここでは触らない
      await addPostComment(post.id, {
        userId: currentUser.uid,
        userName,
        text: text.trim(),
        type: tab,
        renId: tab === 'instructor' ? adminRens[0].renId : undefined,
      });
      setText('');
    } catch (error) {
      console.error(error);
      Alert.alert('失敗', 'コメントの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const onLike = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      // likeCountはCloud Functionsトリガ(onLikeWrite)がcount()集計で
      // 自動更新するため、ここではlikesドキュメントの作成のみ行う
      await likePost(post.id, currentUser.uid);
    } catch (e) {
      Alert.alert("失敗", "拍手の送信に失敗しました");
    }
  };

  return (
    <SafeAreaView style={styles.detailContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft color={colors.gold} size={24} />
          <Text style={{ color: colors.gold, fontWeight: '700' }}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.detailNavTitle} numberOfLines={1}>{post.title}</Text>
      </View>

      <ScrollView stickyHeaderIndices={[2]}>
        <View style={styles.detailVideoBox}><Video style={styles.detailFullVideo} source={{ uri: post.videoUrl }} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping /></View>

        <View style={styles.metaSection}>
          <View style={styles.scoreBadgeLarge}><Award size={19} color={colors.gold} /><Text style={styles.scoreTextLarge}>{formatAiScore(post.score)}</Text></View>

          {/* 踊り子の名前をタップしてプロフィール画面へ遷移する */}
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', {
                userId: post.userId,
                userName: post.authorName
            })}
            style={styles.authorProfileBtn}
            activeOpacity={0.85}
          >
            <User size={17} color={colors.gold} />
            <Text style={styles.detailAuthorTextClick}>踊り子：{post.authorName} のプロフィールを見る ＞</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clapBtn} onPress={onLike} activeOpacity={0.85}>
            <Heart size={18} color={colors.aka} fill={colors.aka} />
            <Text style={styles.clapBtnText}>拍手を送る（{post.likeCount}）</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, tab === 'instructor' && styles.tabActive]} onPress={() => setTab('instructor')}><Text style={[styles.tabLabel, tab === 'instructor' && styles.tabLabelActive]}>師匠の教え</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'normal' && styles.tabActive]} onPress={() => setTab('normal')}><Text style={[styles.tabLabel, tab === 'normal' && styles.tabLabelActive]}>門下生の声</Text></TouchableOpacity>
        </View>

        <View style={styles.commentContainer}>
          {comments.filter(c => c.type === tab).map(c => (
            <View key={c.id} style={styles.comBubble}>
              <Text style={styles.comName}>{c.userName}</Text>
              <Text style={styles.comText}>{c.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {tab === 'instructor' && !canPostInstructor ? (
        <View style={styles.inputDockDisabled}>
          <Text style={styles.inputDockDisabledText}>指導者コメントは連の管理者のみ投稿できます</Text>
        </View>
      ) : (
        <View style={styles.inputDock}>
          <TextInput style={styles.textInput} placeholder="感想やアドバイスを入力..." placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} />
          <TouchableOpacity style={styles.sendBtn} onPress={onSend} disabled={sending} activeOpacity={0.85}>
            {sending ? <ActivityIndicator color={colors.textOnGold} size="small" /> : <Send color={colors.textOnGold} size={19} />}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  topNav: { height: 65, backgroundColor: colors.indigo, justifyContent: 'center', paddingHorizontal: spacing.xl, borderBottomWidth: 1, borderColor: colors.indigoLine },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: 36, height: 36, backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  brandName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 16 },
  brandSub: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  badgeGold: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.indigoLine, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: spacing.sm },
  badgeGoldText: { color: colors.gold, fontSize: 9, fontWeight: '700' },

  hero: { padding: spacing.xl, backgroundColor: colors.indigo, borderBottomWidth: 1, borderColor: colors.indigoLine },
  heroBadge: { backgroundColor: colors.indigoRaised, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginBottom: spacing.sm },
  heroBadgeText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  heroContentRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { ...typography.titleSerif, color: colors.textPrimary, fontSize: 24 },
  heroSub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  heroBtn: { backgroundColor: colors.gold, flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center', marginLeft: spacing.sm },
  heroBtnText: { color: colors.textOnGold, fontWeight: '700', marginLeft: 5, fontSize: 13 },

  searchSection: { padding: spacing.md, backgroundColor: colors.indigo },
  searchBar: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, height: 42, borderRadius: radius.sm },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, ...typography.body, fontSize: 14 },
  tagBar: { paddingLeft: spacing.md, backgroundColor: colors.indigo, paddingBottom: spacing.md },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.indigoRaised, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.indigoLine },
  tagActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tagText: { fontSize: 13, color: colors.textSecondary },
  tagTextActive: { color: colors.textOnGold, fontWeight: '700' },

  grid: { padding: spacing.md },
  card: { backgroundColor: colors.indigo, borderRadius: radius.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.indigoLine, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', padding: spacing.md },
  thumbWrapper: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: '#000', overflow: 'hidden' },
  scoreBadgeMini: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(11,19,43,0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  scoreValueMini: { color: colors.gold, fontSize: 10, fontWeight: '700' },
  cardBody: { flex: 1, marginLeft: spacing.lg, justifyContent: 'center' },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 16, marginBottom: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.indigoRaised, justifyContent: 'center', alignItems: 'center' },
  avatarTextMini: { fontSize: 10, color: colors.gold },
  authorName: { marginLeft: spacing.sm, fontSize: 13, color: colors.textMuted },
  cardFooter: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.xl },
  statText: { fontSize: 12, marginLeft: spacing.xs, color: colors.textMuted },

  modalContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.indigoLine },
  modalTitle: { ...typography.headingSerif, color: colors.textPrimary },
  picker: { height: 180, backgroundColor: colors.indigoRaised, borderRadius: radius.md, borderStyle: 'dashed', borderWidth: 2, borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, overflow: 'hidden' },
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  input: { backgroundColor: colors.indigoRaised, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.md, borderRadius: radius.sm, marginBottom: spacing.xl, color: colors.textPrimary, ...typography.body },
  submitBtn: { backgroundColor: colors.gold, padding: spacing.lg, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.textOnGold, fontWeight: '700', fontSize: 16 },

  detailContainer: { flex: 1, backgroundColor: colors.indigoDeep },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.indigoLine, gap: spacing.md },
  detailNavTitle: { fontSize: 15, fontWeight: '700', flex: 1, color: colors.textPrimary },
  detailVideoBox: { backgroundColor: '#000', height: 280 },
  detailFullVideo: { width: '100%', height: '100%' },
  metaSection: { padding: spacing.xl, borderBottomWidth: 1, borderColor: colors.indigoLine },
  scoreBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, alignSelf: 'flex-start' },
  scoreTextLarge: { color: colors.gold, fontWeight: '900', marginLeft: spacing.sm, fontSize: 18 },
  authorProfileBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  detailAuthorTextClick: { marginLeft: spacing.sm, fontSize: 14, color: colors.gold, fontWeight: '600' },
  clapBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.akaSoft, borderRadius: radius.pill, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.aka },
  clapBtnText: { color: colors.aka, marginLeft: spacing.sm, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.indigoDeep, borderBottomWidth: 1, borderColor: colors.indigoLine },
  tabItem: { flex: 1, paddingVertical: spacing.lg, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabLabel: { color: colors.textMuted, fontWeight: '700' },
  tabLabelActive: { color: colors.gold },
  commentContainer: { padding: spacing.xl, minHeight: 200 },
  comBubble: { backgroundColor: colors.indigo, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.gold },
  comName: { fontSize: 12, fontWeight: '700', color: colors.gold, marginBottom: spacing.xs },
  comText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  inputDock: { flexDirection: 'row', padding: spacing.md, borderTopWidth: 1, borderColor: colors.indigoLine, backgroundColor: colors.indigo },
  textInput: { flex: 1, backgroundColor: colors.indigoRaised, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 44, color: colors.textPrimary },
  sendBtn: { backgroundColor: colors.gold, width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.sm },
  inputDockDisabled: { padding: spacing.md, borderTopWidth: 1, borderColor: colors.indigoLine, backgroundColor: colors.indigo },
  inputDockDisabledText: { textAlign: 'center', fontSize: 12, color: colors.textMuted },
});
