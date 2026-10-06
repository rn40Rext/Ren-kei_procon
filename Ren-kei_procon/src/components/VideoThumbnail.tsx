/**
 * 動画の先頭フレームを縮小して見せるサムネイル(ネイティブ向け)。
 * ネイティブの expo-video は先頭フレームを表示できるので、RenkeiVideo をそのまま使う。
 * Web 実装は VideoThumbnail.web.tsx(Metro が自動で差し替える)。
 */
import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import RenkeiVideo from "./RenkeiVideo";

export default function VideoThumbnail({
  uri,
  style,
  contentFit = "cover",
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** cover: 枠を埋める(一覧用) / contain: 全体を収める(投稿前の確認用) */
  contentFit?: "cover" | "contain";
}) {
  return <RenkeiVideo uri={uri} style={style} contentFit={contentFit} muted />;
}
