/**
 * カメラ映像 + 骨格オーバーレイ(ネイティブ向け既定実装)。
 *
 * iOS / Android ではリアルタイム姿勢推定が未対応(TBD-01: Prototype 1 は Web 版)。
 * expo-camera のプレビューだけを出し、映像ソースは提供しない(onSource(null))。
 * Web 実装は PoseCameraView.web.tsx にあり、Metro が自動で差し替える。
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView } from "expo-camera";
import { LiveVideoSource } from "../features/analysis/liveTypes";
import { colors } from "../theme/colors";

export type PoseCameraViewProps = {
  /** 映像ソースが使えるようになったら呼ぶ。未対応なら null */
  onSource: (source: LiveVideoSource | null) => void;
  /** 動画ファイル再生が終わったとき(Web のみ) */
  onEnded?: () => void;
  /** 骨格を描くか */
  showSkeleton?: boolean;
  /** true なら動画ファイルの選択 UI を出す(Web のみ) */
  allowFile?: boolean;
  style?: object;
};

export default function PoseCameraView({ onSource, style }: PoseCameraViewProps) {
  useEffect(() => {
    onSource(null);
  }, [onSource]);
  return (
    <View style={[styles.container, style]}>
      <CameraView style={styles.camera} />
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          リアルタイム判定は Web 版(パソコンのブラウザ)で利用できます。{"\n"}
          スマホアプリ版は姿勢推定のネイティブ組み込み(TBD-01)が未対応です。
        </Text>
      </View>
    </View>
  );
}

export const POSE_CAMERA_SUPPORTED = false;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  notice: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.noticeBackground,
    borderRadius: 10,
    padding: 12,
  },
  noticeText: { color: colors.noticeText, fontSize: 13, lineHeight: 19 },
});
