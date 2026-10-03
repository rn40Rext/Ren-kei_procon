/**
 * 動画の先頭フレームを縮小して見せるサムネイル(Web実装)。
 *
 * expo-video の Web 実装は素の <video src> を出すだけで、preload も失敗時の
 * 代替表示も無いため、端末によっては真っ黒な枠になっていた
 * (特に MediaRecorder で撮った WebM はシーク用の情報が無く、iOS Safari では再生自体できないことがある)。
 *  - 動画の始めは構えたままの固まった絵になりやすいので、THUMBNAIL_SEC(2秒)付近のフレームを使う。
 *    src に #t=2 を付け、preload="metadata" でそこまでのフレームだけを取りにいく。
 *    2秒より短い動画は、末尾に飛んで真っ黒にならないよう中間のフレームにする
 *  - 映像が出るまで・出せなかったときは、背面のプレースホルダー(再生アイコン)が見える
 * 一覧に何枚も並ぶので、全体を先読みしない(preload="metadata")。
 */
import React, { useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { IconEnbuPlay } from "./awaIcons";
import { colors } from "../theme";

/** サムネイルに使う位置[秒] */
const THUMBNAIL_SEC = 2;

export default function VideoThumbnail({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = uri.includes("#") ? uri : `${uri}#t=${THUMBNAIL_SEC}`;

  return (
    <View style={[styles.box, style]} pointerEvents="none">
      <View style={styles.placeholder}>
        <IconEnbuPlay size={22} color={colors.gold} />
      </View>
      {!failed && (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          controls={false}
          disablePictureInPicture
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            // 長さが分かる(MP4など)短い動画だけ補正する。MediaRecorderのWebMは長さが不明(Infinity)で、そのまま#t=2に任せる
            if (Number.isFinite(v.duration) && v.duration < THUMBNAIL_SEC + 0.5) v.currentTime = v.duration / 2;
          }}
          onLoadedData={() => setShown(true)}
          onSeeked={() => setShown(true)}
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: shown ? 1 : 0,
            pointerEvents: "none",
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: colors.indigoRaised },
  placeholder: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
