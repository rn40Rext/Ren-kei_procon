import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, typography } from '../theme';

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

const PART_LABEL: Record<string, string> = { feet: '足捌き', hands: '手・団扇', whole: '全体の調和' };

export default function CameraScreen() {
  const route = useRoute<CameraScreenRouteProp>();
  const { danceType, scorePart } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const navigation = useNavigation<CameraScreenNavigationProp>();

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Text style={styles.permText}>演舞の撮影にはカメラの許可が必要です</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>カメラを許可する</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} />

      <View style={styles.info}>
        <View style={styles.tags}>
          <Text style={styles.tag}>{danceType === 'male' ? '男踊り' : '女踊り'}</Text>
          <Text style={styles.tagDot}>・</Text>
          <Text style={styles.tag}>{PART_LABEL[scorePart] ?? '全体'}</Text>
        </View>

        <TouchableOpacity style={styles.finishButton} onPress={() => navigation.navigate('Result')} activeOpacity={0.85}>
          <Text style={styles.finishButtonText}>演舞を締める</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  info: { backgroundColor: colors.indigoDeep, padding: spacing.lg, alignItems: 'center' },
  tags: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  tag: { ...typography.bodyStrong, color: colors.gold },
  tagDot: { ...typography.bodyStrong, color: colors.textMuted, marginHorizontal: 4 },
  finishButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  finishButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },

  permWrap: { flex: 1, backgroundColor: colors.indigoDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  permText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  permBtn: { backgroundColor: colors.gold, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.sm },
  permBtnText: { ...typography.button, color: colors.textOnGold },
});
