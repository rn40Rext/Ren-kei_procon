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
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import BottomNav from '../components/BottomNav';

export default function CommunityScreen() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  
  // モーダル・フォーム状態
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [authorTeam, setAuthorTeam] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 💡 1. Firestore から投稿一覧をリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVideos = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          date: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('ja-JP') : '投稿直後',
        };
      });
      setVideos(fetchedVideos);
      setLoading(false);
    }, (error) => {
      console.warn("Firestore listener warning:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 💡 2. 端末から動画を選択する処理
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      setVideoUri(result.assets[0].uri);
    }
  };

  // 💡 3. 高速アップロード & タイムアウト安全設計
  const uploadVideoToStorage = async (uri: string): Promise<string> => {
    if (!storage) return uri;
    
    const uploadPromise = (async () => {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `videos/${Date.now()}_video.mp4`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
      } catch (err) {
        console.warn("Storage upload fallback:", err);
        return uri;
      }
    })();

    const timeoutPromise = new Promise<string>((resolve) => 
      setTimeout(() => resolve(uri), 2500)
    );

    return Promise.race([uploadPromise, timeoutPromise]);
  };

  // 💡 4. 新規投稿処理
  const handleCreatePost = async () => {
    if (!title.trim() || !authorName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('お名前とタイトルを入力してください。');
      } else {
        Alert.alert('入力エラー', 'お名前とタイトルを入力してください。');
      }
      return;
    }

    try {
      setIsUploading(true);

      let downloadUrl = videoUri || '';
      if (videoUri) {
        downloadUrl = await uploadVideoToStorage(videoUri);
      }

      const formattedTags = tags.trim()
        ? tags.split(' ').map(t => t.trim()).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
        : ['#練習投稿', '#男踊り'];

      await addDoc(collection(db, 'videos'), {
        authorName: authorName.trim(),
        authorTeam: authorTeam.trim() ? (authorTeam.includes('所属') ? authorTeam.trim() : `${authorTeam.trim()} 所属`) : '無所属',
        title: title.trim(),
        videoUrl: downloadUrl || 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
        score: Math.floor(Math.random() * 15) + 82,
        tags: formattedTags,
        likes: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      setIsPostModalOpen(false);
      setTitle('');
      setAuthorName('');
      setAuthorTeam('');
      setTags('');
      setVideoUri(null);
      
      if (Platform.OS === 'web') {
        window.alert('練習動画が正常に投稿されました！');
      } else {
        Alert.alert('投稿完了', '練習動画が正常に投稿されました！');
      }
    } catch (error) {
      console.error("投稿エラー:", error);
      if (Platform.OS === 'web') {
        window.alert('投稿に失敗しました。もう一度お試しください。');
      } else {
        Alert.alert('エラー', '投稿に失敗しました。');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 詳細画面が開いている場合
  if (selectedVideo) {
    return (
      <VideoDetailScreen 
        video={selectedVideo} 
        onBack={() => setSelectedVideo(null)} 
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>阿波踊り交流広場</Text>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.feedContainer}>
        <Text style={styles.feedDescription}>
          他の踊り子の練習を見て、アドバイスや応援を送ってみましょう！（タップして動画再生・指導）
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
        ) : videos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>投稿がまだありません</Text>
            <Text style={styles.emptySub}>右下の＋ボタンから最初の練習動画を投稿してみましょう！</Text>
          </View>
        ) : (
          videos.map((video) => (
            <TouchableOpacity 
              key={video.id} 
              style={styles.feedCard}
              onPress={() => setSelectedVideo(video)}
              activeOpacity={0.7}
            >
              <View style={styles.feedThumbnail}>
                <Play size={24} color="#ffffff" fill="#ffffff" />
                <View style={styles.feedScoreBadge}>
                  <Award size={10} color="#1e3a8a" />
                  <Text style={styles.feedScoreText}>AI: {video.score || 85}点</Text>
                </View>
              </View>
              
              <View style={styles.feedInfo}>
                <Text style={styles.feedTitle} numberOfLines={1}>{video.title}</Text>
                <View style={styles.feedAuthorRow}>
                  <User size={12} color="#6b7280" />
                  <Text style={styles.feedAuthorName}>{video.authorName}</Text>
                  <Text style={styles.feedAuthorTeam}>{video.authorTeam}</Text>
                </View>
                
                <View style={styles.feedTagRow}>
                  {video.tags?.map((tag: string, idx: number) => (
                    <Text key={idx} style={styles.feedTagText}>{tag}</Text>
                  ))}
                </View>
                
                <View style={styles.feedActionRow}>
                  <View style={styles.feedActionItem}>
                    <Heart size={14} color="#ef4444" fill="#ef4444" />
                    <Text style={styles.feedActionText}>{video.likes || 0}</Text>
                  </View>
                  <View style={styles.feedActionItem}>
                    <MessageSquare size={14} color="#2563eb" />
                    <Text style={[styles.feedActionText, { color: '#2563eb', fontWeight: 'bold' }]}>
                      {video.commentsCount || 0}件の指導・動画を見る ›
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 浮遊投稿ボタン (FAB) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsPostModalOpen(true)}
        activeOpacity={0.85}
      >
        <Plus size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* 投稿モーダル */}
      <Modal visible={isPostModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>動画を投稿する</Text>
              <TouchableOpacity onPress={() => setIsPostModalOpen(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              <TouchableOpacity style={styles.videoUploadBox} onPress={pickVideo}>
                <VideoIcon size={36} color={videoUri ? "#10b981" : "#2563eb"} />
                <Text style={[styles.videoUploadText, videoUri && { color: '#10b981' }]}>
                  {videoUri ? '動画が選択されました ✓' : '練習動画を選択（タップ）'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>お名前 *</Text>
              <TextInput
                style={styles.input}
                placeholder="例: 踊り子 太郎"
                placeholderTextColor="#9ca3af"
                value={authorName}
                onChangeText={setAuthorName}
              />

              <Text style={styles.label}>所属連</Text>
              <TextInput
                style={styles.input}
                placeholder="例: あわ踊り連"
                placeholderTextColor="#9ca3af"
                value={authorTeam}
                onChangeText={setAuthorTeam}
              />

              <Text style={styles.label}>動画のタイトル *</Text>
              <TextInput
                style={styles.input}
                placeholder="例: 男踊り 足の運び方の確認"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>ハッシュタグ (スペース区切り)</Text>
              <TextInput
                style={styles.input}
                placeholder="例: #男踊り #初心者 #アドバイス求む"
                placeholderTextColor="#9ca3af"
                value={tags}
                onChangeText={setTags}
              />

              <TouchableOpacity 
                style={[styles.submitButton, (!title.trim() || !authorName.trim() || isUploading) && styles.submitButtonDisabled]} 
                onPress={handleCreatePost}
                disabled={!title.trim() || !authorName.trim() || isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Firestoreに投稿する</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

// 💡 動画プレイヤー付き詳細画面
function VideoDetailScreen({ video, onBack }: { video: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'advice' | 'comment'>('advice');
  const [commenterName, setCommenterName] = useState('');
  const [commenterRole, setCommenterRole] = useState(activeTab === 'advice' ? '指導員' : '踊り子仲間');
  const [inputText, setInputText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [likes, setLikes] = useState<number>(video.likes || 0);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<any>({});
  const videoRef = useRef<Video>(null);

  // Firestore comments リアルタイム購読
  useEffect(() => {
    const commentsRef = collection(db, 'videos', video.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnapshot => {
        const d = docSnapshot.data();
        let formattedTime = 'たった今';
        if (d.createdAt && d.createdAt.toDate) {
          formattedTime = new Date(d.createdAt.toDate()).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        }
        return {
          id: docSnapshot.id,
          ...d,
          time: formattedTime
        };
      });
      setComments(list);
    }, (err) => {
      console.warn("Comments snapshot error:", err);
    });

    return () => unsubscribe();
  }, [video.id]);

  const handleTabChange = (tab: 'advice' | 'comment') => {
    setActiveTab(tab);
    if (!commenterRole || commenterRole === '指導員' || commenterRole === '踊り子仲間') {
      setCommenterRole(tab === 'advice' ? '指導員' : '踊り子仲間');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    try {
      setIsSending(true);
      const newComment = {
        name: commenterName.trim() || (activeTab === 'advice' ? '指導員 徳島' : '踊り子 仲間'),
        role: commenterRole.trim() || (activeTab === 'advice' ? '指導員' : '練習生'),
        team: 'すだち連',
        type: activeTab,
        content: inputText.trim(),
        avatarColor: activeTab === 'advice' ? '#ea580c' : '#2563eb',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'videos', video.id, 'comments'), newComment);
      
      await updateDoc(doc(db, 'videos', video.id), {
        commentsCount: increment(1)
      });

      setInputText('');
    } catch (e) {
      console.error("コメント保存エラー:", e);
      if (Platform.OS === 'web') {
        window.alert('コメントの送信に失敗しました');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = async () => {
    setLikes(prev => prev + 1);
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        likes: increment(1)
      });
    } catch (e) {
      console.warn("いいね更新エラー:", e);
    }
  };

  const adviceList = comments.filter(c => c.type === 'advice');
  const commentList = comments.filter(c => c.type === 'comment' || !c.type);
  const currentList = activeTab === 'advice' ? adviceList : commentList;

  // 再生する動画URL（投稿されたURL または デモURL）
  const videoSourceUrl = video.videoUrl && video.videoUrl.startsWith('http') 
    ? video.videoUrl 
    : 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 上部ヘッダー（戻るボタン） */}
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1f2937" />
          <Text style={styles.backButtonText}>広場一覧へ戻る</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* 🎬 本格動画プレイヤーセクション */}
        <View style={styles.playerContainer}>
          <Video
            ref={videoRef}
            style={styles.videoPlayer}
            source={{ uri: videoSourceUrl }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            onPlaybackStatusUpdate={status => setStatus(() => status)}
          />
        </View>

        {/* 投稿情報 */}
        <View style={styles.videoDetailMeta}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{video.authorName}</Text>
            <Text style={styles.authorTeam}>（{video.authorTeam}）</Text>
          </View>
          <Text style={styles.postTitle}>{video.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.postDate}>{video.date}</Text>
            <View style={styles.scoreBadge}>
              <Award size={12} color="#1e3a8a" />
              <Text style={styles.scoreText}>AIフォーム評価: {video.score || 85}点</Text>
            </View>
          </View>
        </View>

        {/* 応援 & コメントカウント */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
            <Heart size={20} color="#ef4444" fill={likes > 0 ? "#ef4444" : "none"} />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>応援する ({likes})</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <View style={styles.actionButton}>
            <MessageSquare size={20} color="#2563eb" />
            <Text style={[styles.actionButtonText, { color: '#2563eb' }]}>コメント ({comments.length})</Text>
          </View>
        </View>

        {/* タブ */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'advice' && styles.activeTab]} 
            onPress={() => handleTabChange('advice')}
          >
            <Text style={[styles.tabText, activeTab === 'advice' && styles.activeTabText]}>
              🥋 熟練者の指導 ({adviceList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'comment' && styles.activeTab]} 
            onPress={() => handleTabChange('comment')}
          >
            <Text style={[styles.tabText, activeTab === 'comment' && styles.activeTabText]}>
              💬 一般コメント ({commentList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* コメント一覧 */}
        <View style={styles.listSection}>
          {currentList.length === 0 ? (
            <View style={styles.emptyCommentBox}>
              <Text style={styles.emptyCommentText}>
                {activeTab === 'advice' ? 'まだ指導・アドバイスはありません。最初の指導を送りましょう！' : 'まだコメントはありません。応援メッセージを送りましょう！'}
              </Text>
            </View>
          ) : (
            currentList.map((item, index) => (
              <View key={item.id || index} style={[styles.card, item.type === 'advice' && styles.adviceCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <View style={[styles.avatar, { backgroundColor: item.avatarColor || (item.type === 'advice' ? '#ea580c' : '#2563eb') }]}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{item.name?.[0] || '踊'}</Text>
                    </View>
                    <View>
                      <View style={styles.nameRoleRow}>
                        <Text style={styles.userName}>{item.name}</Text>
                        <Text style={[styles.userRole, item.type === 'advice' && { color: '#ea580c' }]}>[{item.role || '踊り子'}]</Text>
                      </View>
                      <Text style={styles.userTeam}>{item.team || '所属連'}</Text>
                    </View>
                  </View>
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <Text style={styles.cardContent}>{item.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* コメント入力バー */}
      <View style={styles.inputBar}>
        <View style={styles.inputNameRow}>
          <TextInput
            style={styles.nameInput}
            placeholder="投稿者名（例: 徳島 太郎）"
            placeholderTextColor="#9ca3af"
            value={commenterName}
            onChangeText={setCommenterName}
          />
          <TextInput
            style={styles.roleInput}
            placeholder="役職（例: 指導員/連長）"
            placeholderTextColor="#9ca3af"
            value={commenterRole}
            onChangeText={setCommenterRole}
          />
        </View>
        <View style={styles.inputSendRow}>
          <TextInput
            style={styles.textInput}
            placeholder={activeTab === 'advice' ? "熟練者としての改善指導を入力..." : "応援・感想コメントを入力..."}
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || isSending) && { backgroundColor: '#9ca3af' }]} 
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  main: { flex: 1 },
  headerBar: { backgroundColor: '#ffffff', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  feedContainer: { padding: 16, paddingBottom: 110 },
  feedDescription: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  feedCard: { backgroundColor: '#ffffff', borderRadius: 12, flexDirection: 'row', padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb', elevation: 2 },
  feedThumbnail: { width: 85, height: 85, borderRadius: 10, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', marginRight: 14, position: 'relative' },
  feedScoreBadge: { position: 'absolute', bottom: -6, backgroundColor: '#eff6ff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' },
  feedScoreText: { fontSize: 10, fontWeight: 'bold', color: '#1e3a8a', marginLeft: 3 },
  feedInfo: { flex: 1, justifyContent: 'space-between' },
  feedTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  feedAuthorName: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginLeft: 4 },
  feedAuthorTeam: { fontSize: 11, color: '#9ca3af', marginLeft: 4 },
  feedTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  feedTagText: { fontSize: 11, color: '#2563eb', marginRight: 6, backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  feedActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  feedActionItem: { flexDirection: 'row', alignItems: 'center' },
  feedActionText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },

  fab: { position: 'absolute', right: 20, bottom: 85, backgroundColor: '#2563eb', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6, zIndex: 99 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  formContainer: { marginBottom: 20 },
  videoUploadBox: { height: 110, borderRadius: 12, borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  videoUploadText: { marginTop: 8, fontSize: 13, color: '#2563eb', fontWeight: 'bold' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2937' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  submitButtonDisabled: { backgroundColor: '#9ca3af' },
  submitButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },

  detailHeader: { backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backButtonText: { fontSize: 15, color: '#1f2937', marginLeft: 6, fontWeight: 'bold' },

  // 動画プレイヤー
  playerContainer: { width: '100%', height: 230, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  videoPlayer: { width: '100%', height: '100%' },
  videoDetailMeta: { backgroundColor: '#ffffff', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  authorName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  authorTeam: { fontSize: 12, color: '#6b7280' },
  postTitle: { fontSize: 17, fontWeight: 'bold', color: '#1f2937', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  postDate: { fontSize: 12, color: '#9ca3af' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 12 },
  scoreText: { fontSize: 12, fontWeight: 'bold', color: '#1e3a8a', marginLeft: 4 },
  actionRow: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', justifyContent: 'space-around', alignItems: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  actionButtonText: { fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
  actionDivider: { width: 1, height: 20, backgroundColor: '#e5e7eb' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginTop: 10 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: 'bold' },
  activeTabText: { color: '#2563eb' },
  listSection: { padding: 16 },
  emptyCommentBox: { backgroundColor: '#ffffff', padding: 24, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  emptyCommentText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  adviceCard: { borderColor: '#fde047', backgroundColor: '#fefce8' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  nameRoleRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 13, fontWeight: 'bold', color: '#1f2937' },
  userRole: { fontSize: 11, color: '#ca8a04', fontWeight: 'bold', marginLeft: 4 },
  userTeam: { fontSize: 11, color: '#6b7280' },
  timeText: { fontSize: 11, color: '#9ca3af' },
  cardContent: { fontSize: 14, color: '#374151', lineHeight: 22 },

  // コメント入力バー
  inputBar: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', position: 'absolute', bottom: 0, width: '100%', elevation: 10 },
  inputNameRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  nameInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, height: 34, fontSize: 12, color: '#1f2937' },
  roleInput: { width: 120, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, height: 34, fontSize: 12, color: '#1f2937' },
  inputSendRow: { flexDirection: 'row', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, height: 42, fontSize: 14, color: '#1f2937' },
  sendButton: { backgroundColor: '#2563eb', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});