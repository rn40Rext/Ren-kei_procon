import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshCw } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

const PART_LABEL: Record<string, string> = { feet: '足捌き', hands: '手・団扇', whole: '全体の調和' };

export default function CameraScreen() {
  const route = useRoute<CameraScreenRouteProp>();
  const { danceType, scorePart } = route.params;
  const navigation = useNavigation<CameraScreenNavigationProp>();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [recording, setRecording] = useState(false);

  const ready = permission?.granted && micPermission?.granted;

  const requestAll = async () => {
    await requestPermission();
    await requestMicPermission();
  };

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync();
      if (video?.uri) {
        navigation.navigate('Result', { videoUri: video.uri, danceType, scorePart });
      }
    } catch {
      Alert.alert('録画エラー', '演舞の録画に失敗しました。もう一度お試しください。');
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Text style={styles.permText}>
          演舞の撮影には{'\n'}カメラとマイクの許可が必要です
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestAll} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>許可する</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="video">
        {!recording ? (
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RefreshCw size={20} color={colors.kinari} />
          </TouchableOpacity>
        ) : (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>撮影中</Text>
          </View>
        )}
      </CameraView>

      <View style={styles.info}>
        <View style={styles.tags}>
          <Text style={styles.tag}>{danceType === 'male' ? '男踊り' : '女踊り'}</Text>
          <Text style={styles.tagDot}>・</Text>
          <Text style={styles.tag}>{PART_LABEL[scorePart] ?? '全体'}</Text>
        </View>
        <Text style={styles.hint}>全身が画面に入るように置いて撮ってください</Text>

        {!recording ? (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording} activeOpacity={0.85}>
            <Text style={styles.recordButtonText}>演舞を撮る</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.finishButton} onPress={stopRecording} activeOpacity={0.85}>
            <Text style={styles.finishButtonText}>演舞を締める</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  flipBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,19,43,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,19,43,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  recDot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.aka, marginRight: 6 },
  recText: { ...typography.caption, color: colors.kinari },

  info: { backgroundColor: colors.indigoDeep, padding: spacing.lg, alignItems: 'center' },
  tags: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  tag: { ...typography.bodyStrong, color: colors.gold },
  tagDot: { ...typography.bodyStrong, color: colors.textMuted, marginHorizontal: 4 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  recordButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  recordButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
  finishButton: {
    backgroundColor: colors.aka,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  finishButtonText: { ...typography.button, color: colors.textOnAka, fontSize: 14 },

  permWrap: { flex: 1, backgroundColor: colors.indigoDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  permText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  permBtn: { backgroundColor: colors.gold, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.sm },
  permBtnText: { ...typography.button, color: colors.textOnGold },
});
