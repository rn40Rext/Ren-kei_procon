/**
 * 練習動画を、今の画面の上に重ねて再生するモーダル。
 * 画面遷移を増やさない(戻るボタン・履歴に影響しない)ために、画面ではなくモーダルにしている。
 * 採点された動画には採点中のBGMが録画の音声として入っているので、動画の音をそのまま出す。
 * 閉じると動画ごと破棄するので、音も止まる。
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import RenkeiVideo from './RenkeiVideo';

export default function PracticeVideoModal({
  uri,
  onClose,
}: {
  /** 再生する動画。null のときは閉じている */
  uri: string | null;
  onClose: () => void;
}) {
  const { height: windowH } = useWindowDimensions();

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
          {/* 開いている間だけ動画を作る(閉じたら再生も音も止まる) */}
          {uri ? (
            <RenkeiVideo
              uri={uri}
              style={[styles.video, { height: Math.round(windowH * 0.62) }]}
              contentFit="contain"
              nativeControls
              muted={false}
            />
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
});
