import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, VideoContentFit } from 'expo-video';

/**
 * expo-av の <Video> 置き換え。
 * expo-av は SDK 54 で非推奨・SDK 57 で除外されたため、expo-video に移行している。
 * useVideoPlayer はフックなので、リスト内で使う場合はこのコンポーネント単位でマウントする。
 */
export default function RenkeiVideo({
  uri,
  style,
  contentFit = 'cover',
  autoPlay = false,
  loop = false,
  muted = true,
  nativeControls = false,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (autoPlay) p.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
    />
  );
}
