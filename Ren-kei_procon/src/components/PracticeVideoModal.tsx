/**
 * 練習動画を、今の画面の上に重ねて再生するモーダル。
 * 画面遷移を増やさない(戻るボタン・履歴に影響しない)ために、画面ではなくモーダルにしている。
 * 採点された動画は録画に音が入っていないので、採点時のBGMを動画に合わせて流す(Webのみ。切り替え可)。
 * 閉じると動画ごと破棄するので、音も止まる。
 */
import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Volume2, VolumeX, X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import RenkeiVideo from './RenkeiVideo';
import { SCORING_BGM_URL } from '../features/analysis/bgm';

export default function PracticeVideoModal({
  uri,
  scored,
  onClose,
}: {
  /** 再生する動画。null のときは閉じている */
  uri: string | null;
  /** 採点済みの動画か(採点時のBGMを流す対象) */
  scored: boolean;
  onClose: () => void;
}) {
  const { height: windowH } = useWindowDimensions();
  const [bgmOn, setBgmOn] = useState(true);
  const hasBgm = Platform.OS === 'web' && scored;

  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>練習動画</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="閉じる">
              <X size={20} color={colors.gold} />
            </TouchableOpacity>
          </View>
          {/* 開いている間だけ動画を作る(閉じたら再生もBGMも止まる) */}
          {uri ? (
            <RenkeiVideo
              uri={uri}
              style={[styles.video, { height: Math.round(windowH * 0.62) }]}
              contentFit="contain"
              nativeControls
              companionAudioUri={hasBgm && bgmOn ? SCORING_BGM_URL : undefined}
            />
          ) : null}
          {hasBgm ? (
            <TouchableOpacity style={styles.bgmToggle} onPress={() => setBgmOn((v) => !v)} activeOpacity={0.8}>
              {bgmOn ? <Volume2 size={16} color={colors.gold} /> : <VolumeX size={16} color={colors.textMuted} />}
              <Text style={[styles.bgmText, !bgmOn && { color: colors.textMuted }]}>
                {bgmOn ? '採点時のBGMを流している(タップで消す)' : '採点時のBGMを流す'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(11,19,43,0.85)' },
  card: {
    backgroundColor: colors.indigoDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: spacing.md,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { ...typography.headingSerif, color: colors.textPrimary },
  video: { width: '100%', backgroundColor: colors.indigoRaised },
  bgmToggle: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  bgmText: { ...typography.caption, color: colors.gold, marginLeft: spacing.sm },
});
