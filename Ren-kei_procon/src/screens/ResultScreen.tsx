import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { KumihimoRule, NarutoLoader, Chochin } from '../components/motifs';
import RenkeiVideo from '../components/RenkeiVideo';
import { uploadPracticeVideo, DANCE_TYPE_LABEL, SCORE_PART_LABEL } from '../data/practice';

type ResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;
type ResultScreenRouteProp = RouteProp<RootStackParamList, 'Result'>;

type Phase = 'idle' | 'uploading' | 'saved' | 'error';

export default function ResultScreen() {
  const navigation = useNavigation<ResultScreenNavigationProp>();
  const route = useRoute<ResultScreenRouteProp>();
  const params = route.params ?? {};
  const videoUri = params.videoUri;

  const [phase, setPhase] = useState<Phase>(videoUri ? 'uploading' : 'idle');
  const started = useRef(false);

  useEffect(() => {
    if (!videoUri || started.current) return;
    started.current = true;
    let alive = true;
    (async () => {
      try {
        await uploadPracticeVideo({
          uri: videoUri,
          danceType: params.danceType ?? null,
          scorePart: params.scorePart ?? null,
        });
        if (alive) setPhase('saved');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [videoUri, params.danceType, params.scorePart]);

  const meta = [
    params.danceType ? DANCE_TYPE_LABEL[params.danceType] : null,
    params.scorePart ? SCORE_PART_LABEL[params.scorePart] : null,
  ]
    .filter(Boolean)
    .join('・');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <KumihimoRule width={30} />

        {phase === 'uploading' && (
          <>
            <Text style={styles.title}>演舞を保存しています…</Text>
            <NarutoLoader size={34} color={colors.gold} style={{ marginVertical: spacing.lg }} />
            <Text style={styles.text}>撮影した演舞を非公開で保存しています。</Text>
          </>
        )}

        {phase === 'saved' && (
          <>
            <Chochin size={26} lit style={{ marginBottom: spacing.xs }} />
            {videoUri ? <RenkeiVideo uri={videoUri} style={styles.preview} contentFit="cover" muted /> : null}
            <Text style={styles.title}>演舞を保存しました（非公開）</Text>
            {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>AI解析：準備中</Text>
            </View>
            <Text style={styles.text}>
              {lexicon.aiScore}・{lexicon.aiAdvice}はまだ準備中です。{'\n'}
              保存した演舞は「稽古手帳」からいつでも見返せます。
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('VideoList')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>稽古手帳を見る</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.7}>
              <Text style={styles.linkText}>踊り広場へ戻る</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'error' && (
          <>
            <Text style={styles.title}>保存に失敗しました</Text>
            <Text style={styles.text}>
              通信状況をご確認のうえ、もう一度お試しください。{'\n'}ログインが切れている場合もあります。
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>踊り広場へ戻る</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'idle' && (
          <>
            <Text style={styles.title}>
              {lexicon.aiScore}・{lexicon.aiAdvice}
            </Text>
            <Text style={styles.text}>
              AIによる採点・身体操法の指南は準備中です。{'\n'}
              自主稽古から演舞を撮ると、非公開で保存できます。
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Scoring')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>自主稽古へ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.7}>
              <Text style={styles.linkText}>踊り広場へ戻る</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  preview: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    backgroundColor: colors.indigoRaised,
  },
  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center' },
  metaText: { ...typography.caption, color: colors.gold, marginBottom: spacing.sm },
  text: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  statusPill: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  statusPillText: { ...typography.caption, color: colors.gold },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  primaryButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  linkText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
