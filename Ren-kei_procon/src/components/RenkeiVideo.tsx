import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, VideoContentFit } from 'expo-video';
import useCompanionAudio from './useCompanionAudio';

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
  companionAudioUri,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  /** 動画の再生に合わせて一緒に流す音(録画に音が入っていない採点済み動画のBGMなど)。Webのみ */
  companionAudioUri?: string;
}) {
  // 動画プレイヤーを作り、ループ・消音・自動再生の初期設定を行う
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (autoPlay) p.play();
  });

  useCompanionAudio(player, companionAudioUri);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
    />
  );
}
