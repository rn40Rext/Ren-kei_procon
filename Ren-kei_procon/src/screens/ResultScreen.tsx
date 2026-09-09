import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, radius, typography, lexicon } from '../theme';
import { KumihimoRule } from '../components/motifs';

type ResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

export default function ResultScreen() {
  const navigation = useNavigation<ResultScreenNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <KumihimoRule width={30} />
        <Text style={styles.title}>{lexicon.aiScore}・{lexicon.aiAdvice}</Text>
        <Text style={styles.text}>ここに採点結果と身体操法の指南が表示されます（準備中）。</Text>

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
          <Text style={styles.homeButtonText}>踊り広場へ戻る</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  text: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  homeButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.sm,
  },
  homeButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 14 },
});
