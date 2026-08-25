import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, 
  TextInput, Modal, ActivityIndicator, Alert, Dimensions, Platform
} from 'react-native';
import { Play, Heart, MessageSquare, Plus, Search, Video as VideoIcon, X, ChevronLeft, Send, Award, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native'; // 💡 追加
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

// Firebase設定
import { db, storage, auth } from '../config/firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import BottomNav from '../components/BottomNav';

const { width } = Dimensions.get('window');
const TAG_OPTIONS = ['#男踊り', '#女踊り', '#初心者歓迎', '#足の運び', '#鳥追い笠', '#腰落とし', '#2拍子', '#ちびっこ踊り'];

interface VideoPost {
  id: string; authorName: string; authorId: string; title: string; videoUrl: string; 
  score: number; likes: number; commentsCount: number; tags: string[]; createdAt: any;
}

interface CommentData { id: string; userName: string; text: string; type: 'advice' | 'comment'; }

export default function CommunityScreen() {
  const navigation = useNavigation<any>(); // 💡 型エラー回避のため any
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoPost | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState('すべて');

  // 投稿用
  const [postTitle, setPostTitle] = useState('');
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

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setPostVideoUri(result.assets[0].uri);
  };

  const handlePost = async () => {
    if (!postVideoUri || !postTitle) return Alert.alert("エラー", "動画とタイトルを入力してください");
    setIsUploading(true);
    try {
      const res = await fetch(postVideoUri);
      const blob = await res.blob();
      const storageRef = ref(storage, `videos/${Date.now()}.mp4`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      // 💡 目標3: ログイン中のユーザーID (authorId) を一緒に保存する
      const currentUser = auth.currentUser;
      const authorName = currentUser?.email?.split('@')[0] || "匿名踊り子";
      const authorId = currentUser?.uid || "";

      await addDoc(collection(db, 'videos'), {
        title: postTitle,
        authorName: authorName,
        authorId: authorId, // 💡 これにより連絡が可能になる
        videoUrl: url,
        tags: postTags,
        score: Math.floor(Math.random() * 20) + 80,
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      setIsPostModalOpen(false);
      setPostTitle(''); setPostVideoUri(null); setPostTags([]);
      Alert.alert("成功", "動画を投稿しました！");
    } catch (e) { Alert.alert("失敗", "アップロードに失敗しました"); }
    finally { setIsUploading(false); }
  };

  const filteredVideos = selectedTagFilter === 'すべて' ? videos : videos.filter(v => v.tags?.includes(selectedTagFilter));

  if (selectedVideo) {
    return <VideoDetailScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNav}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}><Text style={styles.logoText}>連</Text></View>
          <View style={{marginLeft: 8}}>
            <Text style={styles.brandName}>ren-kei <View style={styles.badgePink}><Text style={styles.badgePinkText}>阿波踊り交流広場</Text></View></Text>
            <Text style={styles.brandSub}>練習動画のAI採点・連の絆を深める広場</Text>
          </View>
        </View>
      </View>

      <ScrollView stickyHeaderIndices={[2]}>
        <LinearGradient colors={['#1E3A8A', '#3B82F6']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✨ リアルタイム共有</Text></View>
          <View style={styles.heroContentRow}>
            <View style={{flex: 1}}>
              <Text style={styles.heroTitle}>阿波踊り 交流広場</Text>
              <Text style={styles.heroSub}>稽古の成果を全国の連に届けよう</Text>
            </View>
            <TouchableOpacity style={styles.heroBtn} onPress={() => setIsPostModalOpen(true)}>
              <Plus color="#2563EB" size={20} />
              <Text style={styles.heroBtnText}>動画を披露</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}><Search color="#94A3B8" size={20} /><TextInput placeholder="検索..." style={styles.searchInput} /></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagBar} contentContainerStyle={{paddingRight: 40}}>
           {['すべて', ...TAG_OPTIONS].map(t => (
             <TouchableOpacity key={t} onPress={() => setSelectedTagFilter(t)} style={[styles.tag, selectedTagFilter === t && styles.tagActive]}>
               <Text style={[styles.tagText, selectedTagFilter === t && styles.tagTextActive]}>{t}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>

        <View style={styles.grid}>
          {loading ? <ActivityIndicator style={{marginTop: 50}}/> : filteredVideos.map(v => (
            <TouchableOpacity key={v.id} style={styles.card} onPress={() => setSelectedVideo(v)}>
              <View style={styles.cardMain}>
                <View style={styles.thumbWrapper}>
                  <Video style={StyleSheet.absoluteFill} source={{uri: v.videoUrl}} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                  <View style={styles.scoreBadgeMini}><Text style={styles.scoreValueMini}>AI {v.score}点</Text></View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{v.title}</Text>
                  <View style={styles.authorRow}>
                    <View style={styles.avatarMini}><Text style={styles.avatarTextMini}>阿</Text></View>
                    <Text style={styles.authorName}>{v.authorName}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.statItem}><Heart size={16} color="#F43F5E" /><Text style={styles.statText}>{v.likes}</Text></View>
                <View style={styles.statItem}><MessageSquare size={16} color="#64748B" /><Text style={styles.statText}>{v.commentsCount}</Text></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{height: 100}} />
      </ScrollView>

      {/* 投稿モーダル */}
      <Modal visible={isPostModalOpen} animationType="slide">
        <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>稽古動画を披露する</Text><TouchableOpacity onPress={()=>setIsPostModalOpen(false)}><X color="#000" /></TouchableOpacity></View>
          <ScrollView style={{padding: 20}}>
            <TouchableOpacity style={styles.picker} onPress={pickVideo}>
              {postVideoUri ? <Video style={StyleSheet.absoluteFill} source={{uri: postVideoUri}} resizeMode={ResizeMode.CONTAIN} isLooping shouldPlay /> : <View style={{alignItems:'center'}}><VideoIcon size={48} color="#2563EB" /><Text style={{marginTop:10, color:'#2563EB', fontWeight:'bold'}}>動画を選択してください</Text></View>}
            </TouchableOpacity>
            <Text style={styles.label}>タイトル</Text>
            <TextInput style={styles.input} placeholder="例：男踊り 基本の足運び" value={postTitle} onChangeText={setPostTitle} />
            <Text style={styles.label}>タグ設定 (#複数選択可)</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20}}>
              {TAG_OPTIONS.map(t => (
                <TouchableOpacity key={t} onPress={() => postTags.includes(t) ? setPostTags(postTags.filter(x=>x!==t)) : setPostTags([...postTags, t])} style={[styles.tag, postTags.includes(t) && styles.tagActive]}>
                  <Text style={[styles.tagText, postTags.includes(t) && styles.tagTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handlePost} disabled={isUploading}>{isUploading ? <ActivityIndicator color="#fff"/> : <Text style={styles.submitBtnText}>広場へ披露する</Text>}</TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

// --- 詳細画面 ---
function VideoDetailScreen({ video, onBack }: { video: VideoPost, onBack: () => void }) {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'advice' | 'comment'>('advice');
  const [text, setText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'videos', video.id, 'comments'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() } as CommentData))));
  }, [video.id]);

  const onSend = async () => {
    if (!text.trim()) return;
    const currentUser = auth.currentUser;
    const userName = currentUser?.email?.split('@')[0] || "匿名";

    await addDoc(collection(db, 'videos', video.id, 'comments'), {
      userName, text: text.trim(), type: tab, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'videos', video.id), { commentsCount: increment(1) });
    setText('');
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={{flexDirection:'row', alignItems:'center'}}><ChevronLeft color="#2563EB" size={30} /><Text style={{color:'#2563EB', fontWeight:'bold'}}>戻る</Text></TouchableOpacity>
        <Text style={styles.detailNavTitle} numberOfLines={1}>{video.title}</Text>
      </View>
      
      <ScrollView stickyHeaderIndices={[2]}>
        <View style={styles.detailVideoBox}><Video style={styles.detailFullVideo} source={{uri: video.videoUrl}} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping /></View>

        <View style={styles.metaSection}>
          <View style={styles.scoreBadgeLarge}><Award size={20} color="#FACC15" /><Text style={styles.scoreTextLarge}>AI採点 {video.score}点</Text></View>
          
          {/* 💡 目標4: 踊り子の名前をタップしてプロフィール画面へ飛ぶ */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('UserProfile', { 
                userId: video.authorId, 
                userName: video.authorName 
            })}
            style={styles.authorProfileBtn}
          >
            <User size={18} color="#2563EB" />
            <Text style={styles.detailAuthorTextClick}>踊り子：{video.authorName} のプロフィールを見る ＞</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clapBtn} onPress={async () => await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) })}>
            <Heart size={20} color="#E11D48" fill="#E11D48" />
            <Text style={styles.clapBtnText}>拍手を送る ({video.likes})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, tab === 'advice' && styles.tabActive]} onPress={() => setTab('advice')}><Text style={[styles.tabLabel, tab === 'advice' && styles.tabLabelActive]}>師匠の教え</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, tab === 'comment' && styles.tabActive]} onPress={() => setTab('comment')}><Text style={[styles.tabLabel, tab === 'comment' && styles.tabLabelActive]}>門下生の声</Text></TouchableOpacity>
        </View>

        <View style={styles.commentContainer}>
          {comments.filter(c => c.type === tab).map(c => (
            <View key={c.id} style={styles.comBubble}><Text style={styles.comName}>👤 {c.userName}</Text><Text style={styles.comText}>{c.text}</Text></View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.inputDock}>
        <TextInput style={styles.textInput} placeholder="感想やアドバイスを入力..." value={text} onChangeText={setText} />
        <TouchableOpacity style={styles.sendBtn} onPress={onSend}><Send color="#fff" size={20} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topNav: { height: 65, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: 36, height: 36, backgroundColor: '#2563EB', borderRadius: 8, justifyContent:'center', alignItems:'center' },
  logoText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  brandName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  brandSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  badgePink: { backgroundColor: '#FCE7F3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  badgePinkText: { color: '#DB2777', fontSize: 9, fontWeight: 'bold' },

  hero: { padding: 25 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  heroContentRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 5 },
  heroBtn: { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginLeft: 10 },
  heroBtnText: { color: '#2563EB', fontWeight: 'bold', marginLeft: 5, fontSize: 13 },

  searchSection: { padding: 15, backgroundColor: '#fff' },
  searchBar: { backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 12 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  tagBar: { paddingLeft: 15, backgroundColor: '#fff', paddingBottom: 15 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  tagActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tagText: { fontSize: 13, color: '#1E293B' },
  tagTextActive: { color: '#fff', fontWeight: 'bold' },

  grid: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', elevation: 2 },
  cardMain: { flexDirection: 'row', padding: 12 },
  thumbWrapper: { width: 110, height: 110, borderRadius: 12, backgroundColor: '#000', overflow: 'hidden' },
  scoreBadgeMini: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  scoreValueMini: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardBody: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E2E8F0', justifyContent:'center', alignItems:'center' },
  avatarTextMini: { fontSize: 10 },
  authorName: { marginLeft: 8, fontSize: 14, color: '#64748B' },
  cardFooter: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  statText: { fontSize: 13, marginLeft: 6, color: '#64748B' },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  picker: { height: 180, backgroundColor: '#F1F5F9', borderRadius: 15, borderStyle: 'dashed', borderWidth: 2, borderColor: '#2563EB', justifyContent:'center', alignItems:'center', marginBottom: 20, overflow:'hidden' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#1E293B' },
  input: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  submitBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  detailNavTitle: { marginLeft: 15, fontSize: 16, fontWeight: 'bold', flex: 1 },
  detailVideoBox: { backgroundColor: '#000', height: 280 },
  detailFullVideo: { width: '100%', height: '100%' },
  metaSection: { padding: 20, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  scoreBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, alignSelf: 'flex-start' },
  scoreTextLarge: { color: '#FACC15', fontWeight: '900', marginLeft: 8, fontSize: 18 },
  authorProfileBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingVertical: 8 },
  detailAuthorTextClick: { marginLeft: 8, fontSize: 15, color: '#2563EB', fontWeight: '600' },
  clapBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#FFF1F2', borderRadius: 30, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FDA4AF' },
  clapBtnText: { color: '#E11D48', marginLeft: 10, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#F1F5F9' },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#2563EB' },
  tabLabel: { color: '#64748B', fontWeight: 'bold' },
  tabLabelActive: { color: '#2563EB' },
  commentContainer: { padding: 20, minHeight: 200 },
  comBubble: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#2563EB' },
  comName: { fontSize: 12, fontWeight: 'bold', color: '#2563EB', marginBottom: 5 },
  comText: { fontSize: 15, lineHeight: 22 },
  inputDock: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  textInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 25, paddingHorizontal: 20, height: 45 },
  sendBtn: { backgroundColor: '#2563EB', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});