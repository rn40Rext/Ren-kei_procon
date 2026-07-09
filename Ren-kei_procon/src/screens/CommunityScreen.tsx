import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput } from 'react-native';
import { Play, Heart, User, Award, MessageSquare, Send, ChevronLeft } from 'lucide-react-native';

// 💡 タイムラインに表示する複数人の動画データ（モック）
const MOCK_VIDEOS = [
  {
    id: 1,
    authorName: '阿波 健太',
    authorTeam: '初心者連 所属',
    title: '男踊り 基本フォームの練習',
    date: '2026/07/09',
    score: 88,
    tags: ['#男踊り', '#初心者', '#アドバイス求む'],
    likes: 24,
    comments: 4,
  },
  {
    id: 2,
    authorName: '徳島 花子',
    authorTeam: 'うずしお連 所属',
    title: '女踊り しなやかな手の動き',
    date: '2026/07/09',
    score: 95,
    tags: ['#女踊り', '#経験者', '#手本動画'],
    likes: 156,
    comments: 12,
  },
  {
    id: 3,
    authorName: '鳴門 次郎',
    authorTeam: '無所属',
    title: '初めての阿波踊り、リズムが難しいです',
    date: '2026/07/08',
    score: 65,
    tags: ['#初心者', '#連さがしてます'],
    likes: 12,
    comments: 8,
  }
];

export default function CommunityScreen() {
  // null なら「一覧画面」、動画データが入っていれば「詳細画面」を表示するステート
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // 1. 一覧（タイムライン）画面のレンダリング
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  if (!selectedVideo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>阿波踊り交流広場</Text>
        </View>
        <ScrollView style={styles.main} contentContainerStyle={styles.feedContainer}>
          <Text style={styles.feedDescription}>
            他の踊り子の練習を見て、アドバイスや応援を送ってみましょう！
          </Text>

          {MOCK_VIDEOS.map((video) => (
            <TouchableOpacity 
              key={video.id} 
              style={styles.feedCard}
              onPress={() => setSelectedVideo(video)} // 💡 タップで詳細画面へ！
            >
              <View style={styles.feedThumbnail}>
                <Play size={24} color="#ffffff" fill="#ffffff" />
                <View style={styles.feedScoreBadge}>
                  <Award size={10} color="#1e3a8a" />
                  <Text style={styles.feedScoreText}>AI: {video.score}点</Text>
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
                  {video.tags.map((tag, idx) => (
                    <Text key={idx} style={styles.feedTagText}>{tag}</Text>
                  ))}
                </View>
                
                <View style={styles.feedActionRow}>
                  <View style={styles.feedActionItem}>
                    <Heart size={14} color="#ef4444" />
                    <Text style={styles.feedActionText}>{video.likes}</Text>
                  </View>
                  <View style={styles.feedActionItem}>
                    <MessageSquare size={14} color="#6b7280" />
                    <Text style={styles.feedActionText}>{video.comments}件の指導・声援</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // 2. 詳細（アドバイス・コメント）画面のレンダリング
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  return <VideoDetailScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />;
}

// 💡 詳細画面用のコンポーネント（前回作成したものをベースに動的化）
function VideoDetailScreen({ video, onBack }: { video: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'advice' | 'comment'>('advice');
  const [inputText, setInputText] = useState('');

  // モックのアドバイスデータ
  const adviceList = [
    { name: '山田 栄二', role: '連長', team: '大鳴門連', time: '10分前', content: '少し重心が浮いてしまっているので、常に腰を柔らかく保ち、低い姿勢をキープするよう意識してみてください。足袋の先まで神経を行き渡らせるとさらに良くなります。', avatarColor: '#ea580c' },
    { name: '佐藤 美咲', role: '副連長', team: 'あわ踊り連', time: '1時間前', content: '手の振りは非常にしなやかで良いですが、少し肩に力が入っていますね。肩甲骨から大きく動かすイメージを持つと、疲れにくい踊りになりますよ。', avatarColor: '#2563eb' },
  ];
  const commentList = [
    { name: '徳島 太郎', role: '練習仲間', team: 'すだち連', time: '30分前', content: `AIスコア${video.score}点すごいですね！自分も負けないように動画撮って練習がんばります！`, avatarColor: '#6b7280' }
  ];

  const currentList = activeTab === 'advice' ? adviceList : commentList;

  return (
    <SafeAreaView style={styles.container}>
      {/* 💡 戻るボタンのヘッダー */}
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeft size={24} color="#1f2937" />
          <Text style={styles.backButtonText}>一覧へ戻る</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.main}>
        <View style={styles.videoSection}>
          <View style={styles.thumbnailWrapper}>
            <View style={styles.thumbnailPlaceholder}>
              <Play size={28} color="#ffffff" fill="#ffffff" />
            </View>
          </View>
          <View style={styles.postInfo}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{video.authorName}</Text>
              <Text style={styles.authorTeam}>（{video.authorTeam}）</Text>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.postTitle}>{video.title}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.postDate}>{video.date}</Text>
              <View style={styles.scoreBadge}>
                <Award size={12} color="#1e3a8a" />
                <Text style={styles.scoreText}>AIスコア: {video.score}点</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton}>
            <Heart size={18} color="#ef4444" fill="#ef4444" />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>応援する ({video.likes})</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <View style={styles.actionButton}>
            <MessageSquare size={18} color="#6b7280" />
            <Text style={styles.actionButtonText}>指導・コメント ({adviceList.length + commentList.length})</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'advice' && styles.activeTab]} onPress={() => setActiveTab('advice')}>
            <Text style={[styles.tabText, activeTab === 'advice' && styles.activeTabText]}>熟練者の指導 ({adviceList.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'comment' && styles.activeTab]} onPress={() => setActiveTab('comment')}>
            <Text style={[styles.tabText, activeTab === 'comment' && styles.activeTabText]}>一般コメント ({commentList.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          {currentList.map((item, index) => (
             <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}><User size={14} color="#fff" /></View>
                  <View>
                    <View style={styles.nameRoleRow}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userRole}>[{item.role}]</Text>
                    </View>
                    <Text style={styles.userTeam}>{item.team}</Text>
                  </View>
                </View>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
              <Text style={styles.cardContent}>{item.content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={activeTab === 'advice' ? "指導員としてアドバイスを入力..." : "コメントを入力..."}
          placeholderTextColor="#9ca3af"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton}>
          <Send size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  main: { flex: 1 },
  // --- 一覧（タイムライン）用のスタイル ---
  headerBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  feedContainer: { padding: 16 },
  feedDescription: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  feedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  feedThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  feedScoreBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  feedScoreText: { fontSize: 9, fontWeight: 'bold', color: '#1e3a8a', marginLeft: 2 },
  feedInfo: { flex: 1, justifyContent: 'space-between' },
  feedTitle: { fontSize: 15, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  feedAuthorName: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginLeft: 4 },
  feedAuthorTeam: { fontSize: 11, color: '#9ca3af', marginLeft: 4 },
  feedTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  feedTagText: { fontSize: 10, color: '#2563eb', marginRight: 6 },
  feedActionRow: { flexDirection: 'row', alignItems: 'center' },
  feedActionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  feedActionText: { fontSize: 11, color: '#6b7280', marginLeft: 4 },
  // --- 詳細画面用のスタイル ---
  detailHeader: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backButtonText: { fontSize: 15, color: '#1f2937', marginLeft: 4, fontWeight: '600' },
  videoSection: { backgroundColor: '#ffffff', padding: 20, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  thumbnailWrapper: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  thumbnailPlaceholder: { flex: 1, backgroundColor: '#4b5563', justifyContent: 'center', alignItems: 'center' },
  postInfo: { flex: 1, marginLeft: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  authorName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  authorTeam: { fontSize: 12, color: '#6b7280' },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  postDate: { fontSize: 12, color: '#9ca3af' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 10 },
  scoreText: { fontSize: 11, fontWeight: 'bold', color: '#1e3a8a', marginLeft: 4 },
  actionRow: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', justifyContent: 'space-around', alignItems: 'center' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginLeft: 6 },
  actionDivider: { width: 1, height: 16, backgroundColor: '#e5e7eb' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginTop: 10 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#9ca3af', fontWeight: 'bold' },
  activeTabText: { color: '#2563eb' },
  listSection: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#fde047', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  nameRoleRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  userRole: { fontSize: 12, color: '#ca8a04', fontWeight: 'bold', marginLeft: 4 },
  userTeam: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  timeText: { fontSize: 11, color: '#9ca3af' },
  cardContent: { fontSize: 14, color: '#374151', lineHeight: 22 },
  inputBar: { flexDirection: 'row', backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', position: 'absolute', bottom: 0, width: '100%', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, height: 40, fontSize: 14, color: '#1f2937' },
  sendButton: { backgroundColor: '#2563eb', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});