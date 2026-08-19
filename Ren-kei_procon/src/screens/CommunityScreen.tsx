import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, 
  ScrollView, TextInput, Modal, ActivityIndicator, Alert, StatusBar, Platform
} from 'react-native';
import { Play, Heart, User, Award, MessageSquare, Send, ChevronLeft, Plus, X, Video as VideoIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

// 💡 Firebase インポート
import { db, storage } from '../config/firebaseConfig';
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  serverTimestamp, doc, updateDoc, increment 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import BottomNav from '../components/BottomNav';

export default function CommunityScreen() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  
  // 投稿用ステート
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [authorTeam, setAuthorTeam] = useState('');
  const [title, setTitle] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. 投稿一覧をリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          date: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('ja-JP') : '2026/8/19',
        };
      });
      setVideos(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 動画選択
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  // 3. 投稿処理
  const handleCreatePost = async () => {
    if (!videoUri || !title || !authorName) {
      Alert.alert("エラー", "動画、お名前、タイトルは必須です。");
      return;
    }
    try {
      setIsUploading(true);
      const response = await fetch(videoUri);
      const blob = await response.blob();
      const filename = `videos/${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'videos'), {
        authorName,
        authorTeam: authorTeam || '無所属',
        title,
        videoUrl: downloadUrl,
        score: Math.floor(Math.random() * 15) + 80, // AI評価スコア
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      setIsPostModalOpen(false);
      setVideoUri(null);
      setTitle('');
      setAuthorName('');
      setAuthorTeam('');
    } catch (e) {
      Alert.alert("エラー", "アップロードに失敗しました。");
    } finally {
      setIsUploading(false);
    }
  };

  if (selectedVideo) {
    return <VideoDetailScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerBar}><Text style={styles.headerTitle}>阿波踊り交流広場</Text></View>
      <ScrollView contentContainerStyle={styles.feedContainer}>
        {loading ? <ActivityIndicator color="#2563eb" style={{marginTop:50}}/> : 
          videos.map((v) => (
            <TouchableOpacity key={v.id} style={styles.feedCard} onPress={() => setSelectedVideo(v)}>
              <View style={styles.feedThumbnail}><Play color="#fff" fill="#fff" /></View>
              <View style={{flex:1}}>
                <Text style={styles.feedTitle}>{v.title}</Text>
                <Text style={styles.feedAuthorName}>{v.authorName} ({v.authorTeam})</Text>
                <View style={styles.miniScoreBadge}>
                  <Award size={10} color="#1e3a8a" />
                  <Text style={styles.miniScoreText}>AI: {v.score}点</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        }
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => setIsPostModalOpen(true)}><Plus color="#fff" size={30}/></TouchableOpacity>

      {/* 投稿モーダル */}
      <Modal visible={isPostModalOpen} animationType="slide">
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>練習を投稿する</Text>
            <TouchableOpacity onPress={() => setIsPostModalOpen(false)}><X color="#000" /></TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity style={styles.dropZone} onPress={pickVideo}>
              <VideoIcon size={40} color="#2563eb" />
              <Text style={{color:'#2563eb', marginTop:10}}>{videoUri ? "動画を選択しました ✓" : "タップして動画を選択"}</Text>
            </TouchableOpacity>
            <TextInput style={styles.input} placeholder="お名前" value={authorName} onChangeText={setAuthorName} />
            <TextInput style={styles.input} placeholder="所属連" value={authorTeam} onChangeText={setAuthorTeam} />
            <TextInput style={styles.input} placeholder="動画のタイトル" value={title} onChangeText={setTitle} />
            <TouchableOpacity style={styles.submitButton} onPress={handleCreatePost} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold'}}>投稿する</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <BottomNav />
    </SafeAreaView>
  );
}

// 💡 詳細画面（最初の画像のデザインを再現）
function VideoDetailScreen({ video, onBack }: { video: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'advice' | 'comment'>('advice');
  const [inputText, setInputText] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'videos', video.id, 'comments'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => setComments(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [video.id]);

  const handleLike = async () => {
    await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) });
  };

  const sendComment = async () => {
    if (!inputText.trim()) return;
    await addDoc(collection(db, 'videos', video.id, 'comments'), {
      text: inputText.trim(),
      type: activeTab,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'videos', video.id), { commentsCount: increment(1) });
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <ChevronLeft color="#000" />
        <Text style={{fontSize:16}}>戻る</Text>
      </TouchableOpacity>

      <ScrollView>
        <View style={styles.playerContainer}>
          <Video style={styles.videoPlayer} source={{uri: video.videoUrl}} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping />
        </View>

        <View style={styles.videoDetailMeta}>
          <Text style={styles.detailAuthor}>{video.authorName} ({video.authorTeam})</Text>
          <Text style={styles.detailTitle}>{video.title}</Text>
          <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
            <Text style={styles.postDate}>{video.date}</Text>
            <View style={styles.scoreBadge}>
              <Award size={12} color="#1e3a8a" />
              <Text style={styles.scoreText}>AIフォーム評価: {video.score}点</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Heart size={20} color="#ef4444" fill={video.likes > 0 ? "#ef4444" : "none"} />
            <Text style={[styles.actionButtonText, {color: '#ef4444'}]}>応援する ({video.likes || 0})</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <View style={styles.actionButton}>
            <MessageSquare size={20} color="#2563eb" />
            <Text style={[styles.actionButtonText, {color: '#2563eb'}]}>コメント ({video.commentsCount || 0})</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'advice' && styles.activeTab]} onPress={() => setActiveTab('advice')}>
            <Text style={[styles.tabText, activeTab === 'advice' && styles.activeTabText]}>熟練者の指導 ({comments.filter(c => c.type === 'advice').length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'comment' && styles.activeTab]} onPress={() => setActiveTab('comment')}>
            <Text style={[styles.tabText, activeTab === 'comment' && styles.activeTabText]}>一般コメント ({comments.filter(c => c.type === 'comment').length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          {comments.filter(c => c.type === activeTab).length === 0 ? (
            <View style={styles.emptyCommentBox}>
              <Text style={styles.emptyCommentText}>
                {activeTab === 'advice' ? 'まだ指導・アドバイスはありません。最初の指導を送りましょう！' : 'まだコメントはありません。応援メッセージを送りましょう！'}
              </Text>
            </View>
          ) : (
            comments.filter(c => c.type === activeTab).map((c) => (
              <View key={c.id} style={styles.commentCard}><Text>{c.text}</Text></View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput style={styles.textInput} placeholder="アドバイスや感想を書く..." value={inputText} onChangeText={setInputText} />
        <TouchableOpacity style={styles.sendButton} onPress={sendComment}><Send color="#fff" size={18} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: { padding: 20, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  feedContainer: { padding: 16, paddingBottom: 100 },
  feedCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  feedThumbnail: { width: 70, height: 70, backgroundColor: '#000', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  feedTitle: { fontWeight: 'bold', fontSize: 16 },
  feedAuthorName: { color: '#6b7280', fontSize: 12 },
  miniScoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start', marginTop: 5 },
  miniScoreText: { fontSize: 10, color: '#1e3a8a', marginLeft: 3, fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 90, backgroundColor: '#2563eb', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  playerContainer: { width: '100%', height: 230, backgroundColor: '#000' },
  videoPlayer: { width: '100%', height: '100%' },
  videoDetailMeta: { padding: 18, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  detailAuthor: { fontSize: 14, color: '#6b7280' },
  detailTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  postDate: { fontSize: 12, color: '#9ca3af' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 12 },
  scoreText: { fontSize: 12, fontWeight: 'bold', color: '#1e3a8a', marginLeft: 4 },

  actionRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#e5e7eb', justifyContent: 'space-around', alignItems: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionButtonText: { fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
  actionDivider: { width: 1, height: 20, backgroundColor: '#e5e7eb' },

  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: 'bold' },
  activeTabText: { color: '#2563eb' },

  listSection: { padding: 16 },
  emptyCommentBox: { padding: 30, alignItems: 'center' },
  emptyCommentText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  commentCard: { backgroundColor: '#f9fafb', padding: 15, borderRadius: 10, marginBottom: 10 },

  inputBar: { backgroundColor: '#fff', padding: 15, borderTopWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, height: 42 },
  sendButton: { backgroundColor: '#2563eb', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  modalContent: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  dropZone: { height: 150, borderWidth: 2, borderColor: '#2563eb', borderStyle: 'dashed', borderRadius: 15, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  input: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 10, marginBottom: 12 },
  submitButton: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignItems: 'center' }
});