/**
 * U-09「保存動画」: 自分の練習動画一覧(#38)。仕様書5章U-09・14.3・9.2、
 * docs/design/data-model.md 3.2/5章、docs/design/screens.md。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Award, Film, Lock, Send, Trash2, Unlock } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { AnalysisResult, fetchAnalysisResult } from '../repositories/analysis';
import { fetchPostsByUser } from '../repositories/posts';
import { AnalysisStatus, PracticeVideo, deleteVideoRecord, subscribeMyVideos, videoDownloadUrl } from '../repositories/videos';
import { formatAiScore } from '../features/analysis/format';
import { colors } from '../theme/colors';
import BottomNav from '../components/BottomNav';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VideoList'>;

const DANCE_TYPE_LABEL: Record<string, string> = { male: '男踊り', female: '女踊り' };

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  uploaded: '未解析',
  analyzing: '解析中',
  completed: '解析完了',
  failed: '解析失敗',
};

const STATUS_COLOR: Record<AnalysisStatus, string> = {
  uploaded: colors.textSecondary,
  analyzing: colors.gold,
  completed: colors.indigo,
  failed: colors.vermilion,
};

function formatDate(value: PracticeVideo['createdAt']): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function VideoListScreen() {
  const navigation = useNavigation<Nav>();
  const { uid } = useAuth();

  const [videos, setVideos] = useState<PracticeVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, AnalysisResult | null>>({});
  const [postedVideoIds, setPostedVideoIds] = useState<Set<string>>(new Set());
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeMyVideos(uid, setVideos, (e) => {
      console.error('練習動画一覧の取得に失敗しました', e);
      setError('練習動画一覧の取得に失敗しました。時間をおいて再度お試しください');
    });
  }, [uid]);

  // どの動画が既に投稿済みかを調べる(投稿はvideoUrlを直接参照しているため、
  // 投稿済みの動画は削除できないようにする。repositories/videos.tsのコメント参照)。
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchPostsByUser(uid, 200)
      .then((posts) => {
        if (cancelled) return;
        setPostedVideoIds(new Set(posts.filter((p) => p.videoId).map((p) => p.videoId as string)));
      })
      .catch((e) => console.error('投稿済み動画の確認に失敗しました', e));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // サムネイル用の再生可能URLを取得する(storagePathはStorageのパスであり、
  // そのままではVideoのsourceに使えない)。
  useEffect(() => {
    if (!videos) return;
    const targets = videos.filter((v) => v.storagePath && !(v.id in thumbUrls));
    if (targets.length === 0) return;
    let cancelled = false;
    Promise.all(
      targets.map(async (v) => {
        try {
          const url = await videoDownloadUrl(v.storagePath as string);
          return [v.id, url] as const;
        } catch (e) {
          console.error('動画URLの取得に失敗しました', e);
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setThumbUrls((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  // 解析完了済みの動画のスコアを取得する。
  useEffect(() => {
    if (!videos) return;
    const targets = videos.filter((v) => v.analysisStatus === 'completed' && v.latestAnalysisId && !(v.latestAnalysisId in scores));
    if (targets.length === 0) return;
    let cancelled = false;
    Promise.all(
      targets.map(async (v) => {
        try {
          const result = await fetchAnalysisResult(v.latestAnalysisId as string);
          return [v.latestAnalysisId as string, result] as const;
        } catch (e) {
          console.error('解析結果の取得に失敗しました', e);
          return [v.latestAnalysisId as string, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setScores((prev) => {
        const next = { ...prev };
        for (const [analysisId, result] of entries) next[analysisId] = result;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  const onPressVideo = useCallback(
    (v: PracticeVideo) => {
      if (v.analysisStatus === 'completed' && v.latestAnalysisId) {
        navigation.navigate('Result', { analysisId: v.latestAnalysisId, videoId: v.id });
      } else if (v.analysisStatus === 'analyzing') {
        Alert.alert('解析中です', 'しばらくしてから確認してください');
      } else if (v.analysisStatus === 'failed') {
        Alert.alert('解析に失敗しました', 'この動画の採点結果はありません');
      }
    },
    [navigation]
  );

  const onPostToCommunity = useCallback(
    (v: PracticeVideo) => {
      navigation.navigate('Community', { shareVideoId: v.id });
    },
    [navigation]
  );

  const onDelete = useCallback(
    (v: PracticeVideo) => {
      if (postedVideoIds.has(v.id)) {
        Alert.alert('削除できません', 'この動画はすでにコミュニティへ投稿されています。投稿済みの動画は削除できません。');
        return;
      }
      Alert.alert('動画を削除しますか？', 'この操作は取り消せません', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setBusyId(v.id);
            try {
              await deleteVideoRecord(v.id);
            } catch (e) {
              console.error('動画の削除に失敗しました', e);
              Alert.alert('エラー', '動画の削除に失敗しました');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [postedVideoIds]
  );

  const sortedVideos = useMemo(() => videos ?? [], [videos]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>自分の練習動画一覧</Text>
      </View>

      {videos === null && !error ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.indigo} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : sortedVideos.length === 0 ? (
        <View style={styles.emptyState}>
          <Film size={40} color={colors.textSecondary} />
          <Text style={styles.emptyText}>まだ練習動画がありません</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sortedVideos.map((v) => {
            const result = v.latestAnalysisId ? scores[v.latestAnalysisId] : undefined;
            const scoreText = v.analysisStatus === 'completed' ? formatAiScore(result?.totalScore) : null;
            const posted = postedVideoIds.has(v.id);
            return (
              <View key={v.id} style={styles.card}>
                <TouchableOpacity style={styles.cardMain} onPress={() => onPressVideo(v)}>
                  <View style={styles.thumbWrapper}>
                    {thumbUrls[v.id] ? (
                      <Video
                        style={StyleSheet.absoluteFill}
                        source={{ uri: thumbUrls[v.id] }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                      />
                    ) : (
                      <Film size={24} color={colors.textOnDark} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.metaRow}>
                      <Text style={styles.dateText}>{formatDate(v.createdAt)}</Text>
                      {v.danceType && <Text style={styles.danceTypeText}>{DANCE_TYPE_LABEL[v.danceType]}</Text>}
                    </View>
                    <View style={styles.badgeRow}>
                      <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[v.analysisStatus] }]}>
                        <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[v.analysisStatus] }]}>
                          {STATUS_LABEL[v.analysisStatus]}
                        </Text>
                      </View>
                      <View style={styles.visibilityBadge}>
                        {v.visibility === 'public' ? (
                          <Unlock size={12} color={colors.textSecondary} />
                        ) : (
                          <Lock size={12} color={colors.textSecondary} />
                        )}
                        <Text style={styles.visibilityText}>{v.visibility === 'public' ? '公開中' : '非公開'}</Text>
                      </View>
                    </View>
                    {scoreText && (
                      <View style={styles.scoreRow}>
                        <Award size={14} color={colors.gold} />
                        <Text style={styles.scoreText}>{scoreText}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  {v.analysisStatus === 'completed' && !posted && (
                    <TouchableOpacity style={styles.postBtn} onPress={() => onPostToCommunity(v)}>
                      <Send size={14} color={colors.textOnDark} />
                      <Text style={styles.postBtnText}>コミュニティへ投稿</Text>
                    </TouchableOpacity>
                  )}
                  {posted && <Text style={styles.postedText}>投稿済み</Text>}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(v)} disabled={busyId === v.id}>
                    {busyId === v.id ? (
                      <ActivityIndicator size="small" color={colors.vermilion} />
                    ) : (
                      <Trash2 size={16} color={colors.vermilion} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 60,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

  list: { padding: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', padding: 12 },
  thumbWrapper: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: colors.indigo,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 12, color: colors.textSecondary },
  danceTypeText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  visibilityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  visibilityText: { fontSize: 11, color: colors.textSecondary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  scoreText: { fontSize: 13, fontWeight: 'bold', color: colors.textPrimary },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  postBtnText: { color: colors.textOnDark, fontSize: 12, fontWeight: '600' },
  postedText: { fontSize: 12, color: colors.textSecondary },
  deleteBtn: { padding: 6 },
});
