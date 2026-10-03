/**
 * 動画の先頭フレームを縮小して見せるサムネイル(Web実装)。
 *
 * expo-video の Web 実装は素の <video src> を出すだけで、preload も失敗時の
 * 代替表示も無いため、端末によっては真っ黒な枠になっていた
 * (特に MediaRecorder で撮った WebM はシーク用の情報が無く、iOS Safari では再生自体できないことがある)。
 *  - src に #t=0.1 を付け、preload="metadata" で先頭付近のフレームだけを取りにいく
 *  - 映像が出るまで・出せなかったときは、背面のプレースホルダー(再生アイコン)が見える
 * 一覧に何枚も並ぶので、全体を先読みしない(preload="metadata")。
 */
import React, { useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { IconEnbuPlay } from "./awaIcons";
import { colors } from "../theme";

export default function VideoThumbnail({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = uri.includes("#") ? uri : `${uri}#t=0.1`;

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
