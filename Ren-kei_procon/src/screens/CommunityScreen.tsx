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
  const [title, setTitle] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. 投稿一覧をFirestoreからリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVideos(list);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 動画選択処理
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  // 3. 動画アップロード & 投稿処理
  const handleCreatePost = async () => {
    if (!videoUri || !title || !authorName) {
      Alert.alert("エラー", "動画を選択し、お名前とタイトルを入力してください。");
      return;
    }

    try {
      setIsUploading(true);

      // ① 動画ファイルをBlobに変換してStorageにアップロード
      const response = await fetch(videoUri);
      const blob = await response.blob();
      const filename = `videos/${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);
      
      const snapshot = await uploadBytes(storageRef, blob);
      
      // ② 全員が見れる公開URL（DownloadURL）を取得
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // ③ Firestoreに動画情報と「公開URL」を保存
      await addDoc(collection(db, 'videos'), {
        authorName,
        title,
        videoUrl: downloadUrl, // 👈 自分のスマホ内ではなくネット上のURLを保存
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      setIsPostModalOpen(false);
      setVideoUri(null);
      setTitle('');
      setAuthorName('');
      Alert.alert("完了", "広場に公開されました！");
    } catch (e) {
      console.error(e);
      Alert.alert("エラー", "アップロードに失敗しました。ルール設定を確認してください。");
    } finally {
      setIsUploading(false);
    }
  };

  if (selectedVideo) {
    return <VideoDetailScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}><Text style={styles.headerTitle}>阿波踊り交流広場</Text></View>
      
      <ScrollView contentContainerStyle={styles.feedContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{marginTop: 50}} />
        ) : videos.length === 0 ? (
          <Text style={{textAlign:'center', marginTop:50, color:'#9ca3af'}}>まだ投稿がありません</Text>
        ) : (
          videos.map((v) => (
            <TouchableOpacity key={v.id} style={styles.feedCard} onPress={() => setSelectedVideo(v)}>
              <View style={styles.feedThumbnail}><Play color="#fff" fill="#fff" /></View>
              <View style={{flex:1}}>
                <Text style={styles.feedTitle} numberOfLines={1}>{v.title}</Text>
                <Text style={styles.feedAuthorName}>{v.authorName}</Text>
                <Text style={styles.feedActionText}>❤️ {v.likes || 0}   💬 {v.commentsCount || 0}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setIsPostModalOpen(true)}><Plus color="#fff" size={30} /></TouchableOpacity>

      {/* 投稿モーダル */}
      <Modal visible={isPostModalOpen} animationType="slide">
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>練習動画を投稿</Text>
            <TouchableOpacity onPress={() => setIsPostModalOpen(false)}><X color="#000" /></TouchableOpacity>
          </View>
          
          <ScrollView>
            {/* ドラッグ＆ドロップ風の動画選択エリア */}
            <TouchableOpacity 
              style={[styles.dropZone, videoUri && { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]} 
              onPress={pickVideo}
            >
              <VideoIcon size={48} color={videoUri ? "#10b981" : "#2563eb"} />
              <Text style={[styles.dropZoneText, videoUri && { color: '#10b981' }]}>
                {videoUri ? "動画を読み込みました ✓" : "ここをタップして動画を選択"}
              </Text>
              {videoUri && <Text style={{fontSize:10, color:'#10b981'}}>※投稿ボタンを押すと公開されます</Text>}
            </TouchableOpacity>

            <Text style={styles.label}>お名前 *</Text>
            <TextInput style={styles.input} placeholder="例: 徳島 太郎" value={authorName} onChangeText={setAuthorName} />
            
            <Text style={styles.label}>タイトル *</Text>
            <TextInput style={styles.input} placeholder="例: 男踊り 足の練習" value={title} onChangeText={setTitle} />

            <TouchableOpacity 
              style={[styles.submitButton, isUploading && {backgroundColor: '#9ca3af'}]} 
              onPress={handleCreatePost} 
              disabled={isUploading}
            >
              {isUploading ? (
                <View style={{flexDirection:'row'}}><ActivityIndicator color="#fff" /><Text style={{color:'#fff', marginLeft:10}}>アップロード中...</Text></View>
              ) : (
                <Text style={styles.submitButtonText}>動画をネット上に公開する</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <BottomNav />
    </SafeAreaView>
  );
}

// 💡 詳細画面：いいね・コメント機能
function VideoDetailScreen({ video, onBack }: { video: any, onBack: () => void }) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  // コメントのリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, 'videos', video.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (s) => setComments(s.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => unsubscribe();
  }, [video.id]);

  // いいね（応援）を送る
  const handleLike = async () => {
    await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) });
  };

  // コメントを投稿する
  const sendComment = async () => {
    if (!commentText.trim()) return;
    await addDoc(collection(db, 'videos', video.id, 'comments'), {
      text: commentText.trim(),
      createdAt: serverTimestamp()
    });
    // 親ドキュメントのコメント数を増やす
    await updateDoc(doc(db, 'videos', video.id), { commentsCount: increment(1) });
    setCommentText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.detailHeader} onPress={onBack}>
        <ChevronLeft color="#000" />
        <Text style={{marginLeft:5, fontSize:16}}>戻る</Text>
      </TouchableOpacity>

      <ScrollView>
        <Video 
          style={styles.detailPlayer} 
          source={{uri: video.videoUrl}} 
          useNativeControls 
          resizeMode={ResizeMode.CONTAIN} 
          isLooping 
        />
        
        <View style={{padding:20}}>
          <Text style={styles.detailTitle}>{video.title}</Text>
          <Text style={styles.detailAuthor}>投稿者: {video.authorName}</Text>

          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <Heart color="#ef4444" fill="#ef4444" size={24} />
            <Text style={styles.likeButtonText}>応援を送る ({video.likes || 0})</Text>
          </TouchableOpacity>

          <View style={styles.commentSection}>
            <Text style={{fontWeight:'bold', marginBottom:10}}>コメント ({comments.length})</Text>
            <View style={{flexDirection:'row'}}>
              <TextInput 
                style={styles.commentInput} 
                placeholder="アドバイスや感想を書く..." 
                value={commentText} 
                onChangeText={setCommentText} 
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendComment}>
                <Send color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            <View style={{marginTop:20}}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: { padding: 20, borderBottomWidth: 1, borderColor: '#f3f4f6', backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  feedContainer: { padding: 16, paddingBottom: 100 },
  feedCard: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  feedThumbnail: { width: 70, height: 70, backgroundColor: '#1f2937', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  feedTitle: { fontWeight: 'bold', fontSize: 16, color: '#1f2937' },
  feedAuthorName: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  feedActionText: { color: '#4b5563', fontSize: 12, marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 90, backgroundColor: '#2563eb', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalContent: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  dropZone: { height: 180, borderWidth: 2, borderColor: '#2563eb', borderStyle: 'dashed', borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, padding: 20 },
  dropZoneText: { color: '#2563eb', fontWeight: 'bold', marginTop: 12, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f3f4f6', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 15 },
  submitButton: { backgroundColor: '#2563eb', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  detailPlayer: { width: '100%', height: 250, backgroundColor: '#000' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  detailAuthor: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  likeButton: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 12, backgroundColor: '#fef2f2', borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#fee2e2' },
  likeButtonText: { marginLeft: 10, fontWeight: 'bold', color: '#ef4444' },
  commentSection: { marginTop: 30, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 20 },
  commentInput: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 20, fontSize: 14 },
  sendButton: { backgroundColor: '#2563eb', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  commentItem: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  commentText: { fontSize: 14, color: '#374151' }
});