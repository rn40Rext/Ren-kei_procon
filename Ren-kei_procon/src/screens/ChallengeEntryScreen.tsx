/**
 * 師匠からのチャレンジへの「挑戦を投稿」。チャレンジ詳細の「自分の演舞で挑戦する」から開く。
 * AI採点は通さず、ホームの「演舞を投稿する」の「今すぐ撮る」と同じように、
 * その場で撮影(Webはアプリ内の録画、ネイティブは端末のカメラ)するか、ライブラリから動画を選んで投稿する。
 * 投稿には challengeId を付け、交流広場には出さず、お題の「挑戦した人の演舞」にだけ出す
 * (docs/design/challenges.md)。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Film } from 'lucide-react-native';
import { Alert } from '../utils/alert';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, radius, spacing, typography } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import VideoThumbnail from '../components/VideoThumbnail';
import InPageVideoRecorder, { RecordedVideo } from '../components/InPageVideoRecorder';
import { Chip } from '../components/ui';
import { IconEnbuPlay } from '../components/awaIcons';
import { attachPostToChallenge, POST_TAG_OPTIONS, uploadVideoAndPublish } from '../repositories/posts';

type Props = NativeStackScreenProps<RootStackParamList, 'ChallengeEntry'>;

export default function ChallengeEntryScreen({ navigation, route }: Props) {
  const { challengeId, challengeTitle } = route.params;
  // 選んだ(撮った)動画 / アプリ内録画を開いているか / 題名・ひとこと・タグ / 投稿中か
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [title, setTitle] = useState(`「${challengeTitle}」に挑戦`);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // アプリ内録画で作った blob: URL は、差し替え・画面を離れるときに解放する
  const blobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = blobUrlRef.current;
    if (prev && prev !== videoUri) URL.revokeObjectURL(prev);
    blobUrlRef.current = videoUri && videoUri.startsWith('blob:') ? videoUri : null;
  }, [videoUri]);
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  /** 前の画面(チャレンジ詳細)へ戻る。直接URLで開いた場合など戻れないときは詳細を開く */
  const backToChallenge = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Challenge', { challengeId });
  }, [navigation, challengeId]);

  /** 「ライブラリから選ぶ」。写真ライブラリから動画を選ぶ */
  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('権限が必要です', '動画を選ぶにはライブラリへのアクセスを許可してください。');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 120 });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  };

  /** 「今すぐ撮る」。Webはアプリ内録画、ネイティブは端末のカメラ(採点はしない) */
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
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 120 });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  };

  const onRecordedInPage = (media: RecordedVideo) => {
    setVideoUri(URL.createObjectURL(media.blob));
    setRecording(false);
  };

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  /** 動画を投稿し、このお題への挑戦として印(challengeId)を付ける */
  const submit = async () => {
    if (!title.trim() || !videoUri || submitting) return;
    setSubmitting(true);
    try {
      const { postId } = await uploadVideoAndPublish({ uri: videoUri, title, description, tags });
      try {
        await attachPostToChallenge(postId, challengeId);
      } catch (e) {
        console.error('チャレンジへの登録に失敗しました', e);
        Alert.alert('投稿はできましたが、チャレンジへの登録に失敗しました', '交流広場に表示されています。');
        backToChallenge();
        return;
      }
      Alert.alert('挑戦を投稿しました', 'お題の「挑戦した人の演舞」に表示されます');
      backToChallenge();
    } catch (e: any) {
      Alert.alert('投稿に失敗しました', e?.message ?? '時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="挑戦を投稿" note={`お題「${challengeTitle}」`} onBack={backToChallenge} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              撮った(選んだ)動画を、このお題への挑戦として公開します。AIの採点はしません。交流広場には出ず、お題の「挑戦した人の演舞」にだけ表示されます。
            </Text>
          </View>

          {/* 動画。選んでいればその動画(撮り直し・選び直し)、なければ「今すぐ撮る」「ライブラリから選ぶ」 */}
          <Text style={styles.label}>挑戦の動画（必須）</Text>
          {videoUri ? (
            <View style={styles.picked}>
              <View style={styles.pickedPreview}>
                <VideoThumbnail uri={videoUri} contentFit="contain" style={styles.pickedVideo} />
              </View>
              <View style={styles.pickedSide}>
                <TouchableOpacity onPress={pickVideo} disabled={submitting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.link}>動画を選び直す</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={recordVideo}
                  disabled={submitting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginTop: spacing.md }}
                >
                  <Text style={styles.link}>撮り直す</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={recordVideo} activeOpacity={0.85} disabled={submitting}>
                <IconEnbuPlay size={22} color={colors.gold} />
                <Text style={styles.pickBtnText}>今すぐ撮る</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={pickVideo} activeOpacity={0.85} disabled={submitting}>
                <Film size={22} color={colors.gold} />
                <Text style={styles.pickBtnText}>ライブラリから選ぶ</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>題名（必須）</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>ひとこと（任意）</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="意識したところ、難しかったところなど"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
          />
          <Text style={styles.label}>調子・型のしるし</Text>
          <View style={styles.tagWrap}>
            {POST_TAG_OPTIONS.map((t) => (
              <Chip key={t} label={t} active={tags.includes(t)} onPress={() => toggleTag(t)} compact style={{ marginBottom: spacing.sm }} />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submit, (!title.trim() || !videoUri || submitting) && styles.submitDisabled]}
            onPress={submit}
            disabled={!title.trim() || !videoUri || submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.submitText}>挑戦を投稿する</Text>}
          </TouchableOpacity>
          {submitting ? <Text style={styles.hint}>動画をアップロードしています…</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <InPageVideoRecorder visible={recording} onCancel={() => setRecording(false)} onDone={onRecordedInPage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  scroll: { flex: 1, backgroundColor: colors.indigoDeep },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  // お題への挑戦として公開する旨の案内(朱色の枠)
  banner: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.aka,
    backgroundColor: colors.akaSoft,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm, marginTop: spacing.md },
  // 動画を選んだあとの確認枠(左に動画の全体、右に選び直し・撮り直し)
  picked: {
    height: 168,
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: colors.indigo,
    overflow: 'hidden',
  },
  pickedPreview: { width: 150, height: '100%', backgroundColor: colors.indigoRaised },
  pickedVideo: { width: '100%', height: '100%' },
  pickedSide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  link: { ...typography.caption, color: colors.gold, textDecorationLine: 'underline' },
  // 「今すぐ撮る」「ライブラリから選ぶ」(金色の枠)
  pickRow: { flexDirection: 'row', gap: spacing.sm },
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
  input: {
    backgroundColor: colors.indigoRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
