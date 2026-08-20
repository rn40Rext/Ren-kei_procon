import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, 
  ScrollView, TextInput, Modal, ActivityIndicator, Alert, StatusBar, Platform, useWindowDimensions 
} from 'react-native';
import { 
  Play, Heart, Award, Send, ChevronLeft, Plus, X, 
  Video as VideoIcon, Search, MessageSquare, Calendar 
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

// Firebase設定
import { db, storage } from '../config/firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E3A8A',
  accent: '#FACC15',
  bgLight: '#F8FAFC',
  white: '#FFFFFF',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

// 投稿に使用できるタグ一覧
const TAG_OPTIONS = ['#男踊り', '#女踊り', '#初心者歓迎', '#足の運び', '#鳥追い笠', '#腰落とし', '#2拍子', '#ちびっこ踊り'];

interface VideoPost {
  id: string; authorName: string; authorTeam: string; title: string;
  videoUrl: string; score: number; likes: number; commentsCount: number;
  tags: string[]; createdAt: any;
}

export default function CommunityScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width > 768;
  
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoPost | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState('すべて');

  // --- 投稿用ステート ---
  const [postTitle, setPostTitle] = useState('');
  const [postAuthor, setPostAuthor] = useState('');
  const [postVideoUri, setPostVideoUri] = useState<string | null>(null);
  const [postTags, setPostTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => {
      setVideos(s.docs.map(d => ({ id: d.id, ...d.data() } as VideoPost)));
      setLoading(false);
    });
  }, []);

  // 動画選択
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setPostVideoUri(result.assets[0].uri);
    }
  };

  // タグのトグル処理
  const toggleTag = (tag: string) => {
    if (postTags.includes(tag)) {
      setPostTags(postTags.filter(t => t !== tag));
    } else {
      setPostTags([...postTags, tag]);
    }
  };

  // 投稿実行
  const handlePost = async () => {
    if (!postVideoUri || !postTitle || !postAuthor) {
      Alert.alert("エラー", "動画、タイトル、お名前は必須です。");
      return;
    }

    try {
      setIsUploading(true);
      
      // 1. 動画をFirebase Storageにアップロード
      const response = await fetch(postVideoUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `practice_videos/${Date.now()}.mp4`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Firestoreにメタデータを保存
      await addDoc(collection(db, 'videos'), {
        title: postTitle,
        authorName: postAuthor,
        authorTeam: "阿波踊り連",
        videoUrl: downloadURL,
        tags: postTags,
        score: Math.floor(Math.random() * 20) + 80, // AI採点シミュレーション
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      // 3. リセット
      setIsPostModalOpen(false);
      setPostTitle('');
      setPostAuthor('');
      setPostVideoUri(null);
      setPostTags([]);
      Alert.alert("成功", "練習動画を広場に投稿しました！");

    } catch (error) {
      console.error(error);
      Alert.alert("エラー", "投稿に失敗しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredVideos = selectedTagFilter === 'すべて' 
    ? videos 
    : videos.filter(v => v.tags?.includes(selectedTagFilter));

  if (selectedVideo) return <VideoDetailScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNav}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}><Text style={styles.logoText}>連</Text></View>
          <View style={{marginLeft: 10}}>
            <Text style={styles.brandName}>ren-kei <View style={styles.badgePink}><Text style={styles.badgePinkText}>阿波踊り交流広場</Text></View></Text>
            <Text style={styles.brandSub}>練習動画のAI採点・連の絆を深める広場</Text>
          </View>
        </View>
      </View>

      <ScrollView>
        <LinearGradient colors={[COLORS.primaryDark, '#3B82F6']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.heroBanner}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✨ リアルタイム共有</Text></View>
          <View style={styles.heroContentRow}>
            <View style={{flex: 1}}>
              <Text style={styles.heroTitle}>阿波踊り 交流広場</Text>
              <Text style={styles.heroSub}>投稿された練習動画はリアルタイムで公開されます！</Text>
            </View>
            <TouchableOpacity style={styles.heroBtn} onPress={() => setIsPostModalOpen(true)}>
              <Plus color={COLORS.primary} size={20} />
              <Text style={styles.heroBtnText}>練習動画を投稿</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.searchSection}>
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search color={COLORS.textMuted} size={18} />
              <TextInput placeholder="検索..." style={styles.searchInput} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagList}>
            {['すべて', ...TAG_OPTIONS].map(tag => (
              <TouchableOpacity key={tag} onPress={() => setSelectedTagFilter(tag)} style={[styles.tagItem, selectedTagFilter === tag && styles.tagItemActive]}>
                <Text style={[styles.tagText, selectedTagFilter === tag && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.grid, isWeb && styles.webGrid]}>
          {loading ? <ActivityIndicator style={{marginTop: 50}} /> : 
            filteredVideos.map((v) => (
              <TouchableOpacity key={v.id} style={[styles.card, isWeb && styles.webCard]} onPress={() => setSelectedVideo(v)}>
                <View style={styles.cardMain}>
                  <View style={styles.thumbWrapper}>
                    <Video style={StyleSheet.absoluteFill} source={{ uri: v.videoUrl }} resizeMode={ResizeMode.COVER} />
                    <View style={styles.scoreBadge}><Text style={styles.scoreValue}>AI {v.score}点</Text></View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{v.title}</Text>
                    <Text style={styles.authorName}>👤 {v.authorName}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Heart size={14} color="#F43F5E" />
                  <Text style={styles.statText}>{v.likes}</Text>
                  <MessageSquare size={14} color={COLORS.textMuted} style={{marginLeft: 10}} />
                  <Text style={styles.statText}>{v.commentsCount}</Text>
                </View>
              </TouchableOpacity>
            ))
          }
        </View>
      </ScrollView>

      {/* --- 投稿モーダル --- */}
      <Modal visible={isPostModalOpen} animationType="slide">
        <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>練習動画を投稿</Text>
            <TouchableOpacity onPress={() => setIsPostModalOpen(false)}><X color="#000" /></TouchableOpacity>
          </View>
          
          <ScrollView style={{padding: 20}}>
            <TouchableOpacity style={styles.videoPicker} onPress={pickVideo}>
              {postVideoUri ? (
                <Video style={styles.previewVideo} source={{ uri: postVideoUri }} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping />
              ) : (
                <View style={{alignItems: 'center'}}>
                  <VideoIcon size={48} color={COLORS.primary} />
                  <Text style={{marginTop: 10, color: COLORS.primary, fontWeight: 'bold'}}>動画を選択してください</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>タイトル</Text>
            <TextInput style={styles.input} placeholder="練習内容など" value={postTitle} onChangeText={setPostTitle} />

            <Text style={styles.label}>踊り子名</Text>
            <TextInput style={styles.input} placeholder="あなたのお名前" value={postAuthor} onChangeText={setPostAuthor} />

            <Text style={styles.label}>タグを選択 (#複数可)</Text>
            <View style={styles.tagWrap}>
              {TAG_OPTIONS.map(tag => (
                <TouchableOpacity 
                  key={tag} 
                  onPress={() => toggleTag(tag)}
                  style={[styles.postTag, postTags.includes(tag) && styles.postTagActive]}
                >
                  <Text style={[styles.postTagText, postTags.includes(tag) && styles.postTagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, isUploading && {opacity: 0.7}]} 
              onPress={handlePost} 
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>広場に披露する</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

// 詳細画面は前回のコードを維持
function VideoDetailScreen({ video, onBack }: { video: any, onBack: () => void }) {
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
      <TouchableOpacity onPress={onBack} style={{padding: 20}}><Text>← 戻る</Text></TouchableOpacity>
      <Video style={{height: 300, backgroundColor: '#000'}} source={{uri: video.videoUrl}} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay />
      <View style={{padding: 20}}>
        <Text style={{fontSize: 24, fontWeight: 'bold'}}>{video.title}</Text>
        <Text>踊り子: {video.authorName}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLight },
  topNav: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: 34, height: 34, backgroundColor: COLORS.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  brandName: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, flexDirection: 'row', alignItems: 'center' },
  badgePink: { backgroundColor: '#FCE7F3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 5 },
  badgePinkText: { color: '#DB2777', fontSize: 9, fontWeight: 'bold' },
  brandSub: { fontSize: 10, color: COLORS.textMuted },
  
  heroBanner: { padding: 30 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  heroContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 5 },
  heroBtn: { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  heroBtnText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 5 },

  searchSection: { paddingVertical: 15 },
  searchBarContainer: { paddingHorizontal: 20, marginBottom: 15 },
  searchBar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 10 },
  tagList: { paddingHorizontal: 15 },
  tagItem: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  tagItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagText: { fontSize: 13, color: COLORS.textMain },
  tagTextActive: { color: '#fff', fontWeight: 'bold' },

  grid: { padding: 15 },
  webGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  webCard: { width: '48%', marginHorizontal: '1%' },
  cardMain: { flexDirection: 'row', padding: 12 },
  thumbWrapper: { width: 110, height: 110, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden' },
  scoreBadge: { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  scoreValue: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardBody: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 5 },
  authorName: { fontSize: 14, color: COLORS.textMuted },
  cardFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statText: { fontSize: 12, marginLeft: 5, color: COLORS.textMuted },

  // モーダル用
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  videoPicker: { height: 200, backgroundColor: '#F1F5F9', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed' },
  previewVideo: { width: '100%', height: '100%' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: COLORS.textMain },
  input: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  postTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  postTagActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  postTagText: { fontSize: 12, color: COLORS.textMain },
  postTagTextActive: { color: '#fff', fontWeight: 'bold' },
  submitBtn: { backgroundColor: COLORS.primary, padding: 20, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});