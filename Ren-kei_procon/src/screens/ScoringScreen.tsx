import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

type DanceType = "male" | "female";
type ScorePart = "feet" | "hands" | "whole";

const BPM_OPTIONS = [96, 104, 112, 120, 128];

type AnalysisScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'Scoring'>;

export default function AnalysisScreen() {

  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);
  // リズム判定の基準テンポ(TBD-04 の暫定決定: ユーザーが選ぶ。既定はさゝゆり連の実測 112 BPM)
  const [baseBpm, setBaseBpm] = useState<number>(112);

  const navigation = useNavigation<AnalysisScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          踊り解析画面
        </Text>

        <Text style={styles.sectionTitle}>
          踊りの種類
        </Text>

        <TouchableOpacity
          onPress={() => setDanceType('male')}
          style={[
            styles.danceButton,
            danceType === 'male' && styles.selectedButton,
          ]}
        >
          <Text style={styles.buttonText}>男踊り</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setDanceType('female')}
          style={[
            styles.danceButton,
            danceType === 'female' && styles.selectedButton,
          ]}
        >
          <Text style={styles.buttonText}>女踊り</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          採点する部分
        </Text>

        <TouchableOpacity
          onPress={() => setScorePart('feet')}
          style={[
            styles.danceButton,
            scorePart === 'feet' && styles.selectedButton,
          ]}
        >
          <Text style={styles.buttonText}>足だけ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setScorePart('hands')}
          style={[
            styles.danceButton,
            scorePart === 'hands' && styles.selectedButton,
          ]}
        >
          <Text style={styles.buttonText}>手だけ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setScorePart('whole')}
          style={[
            styles.danceButton,
            scorePart === 'whole' && styles.selectedButton,
          ]}
        >
          <Text style={styles.buttonText}>全体</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          基準テンポ(BPM)
        </Text>
        <View style={styles.bpmRow}>
          {BPM_OPTIONS.map((bpm) => (
            <TouchableOpacity
              key={bpm}
              onPress={() => setBaseBpm(bpm)}
              style={[styles.bpmButton, baseBpm === bpm && styles.selectedButton]}
            >
              <Text style={styles.buttonText}>{bpm}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          お囃子のテンポに合わせて選びます。練習は本番より落としたテンポでも構いません。
        </Text>

        <Text style={styles.summaryText}>
          選択中の踊り：
          {danceType === 'male'
            ? '男踊り'
            : danceType === 'female'
              ? '女踊り'
              : '未選択'}
        </Text>

        <Text style={styles.summaryText}>
          採点する部分：
          {scorePart === 'feet'
            ? '足だけ'
            : scorePart === 'hands'
              ? '手だけ'
              : scorePart === 'whole'
                ? '全体'
                : '未選択'}
        </Text>

        <TouchableOpacity
          disabled={danceType === null || scorePart === null}
          style={[styles.nextButton, (danceType === null || scorePart === null) && styles.nextButtonDisabled]}
          onPress={() => {
            if (danceType === null || scorePart === null) {
              return;
            }
            else
              navigation.navigate('Camera', {
                danceType,
                scorePart,
                baseBpm,
              });
          }}
        >
          <Text style={styles.nextButtonText}>次へ</Text>
        </TouchableOpacity>
      </ScrollView>
      <BottomNav />
    </View >

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.indigoDeep,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimaryOnIndigo,
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: 12,
    marginTop: 8,
  },

  danceButton: {
    backgroundColor: colors.indigo,
    padding: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },

  buttonText: { color: colors.textPrimaryOnIndigo },

  selectedButton: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },

  nextButton: {
    backgroundColor: colors.gold,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonDisabled: { opacity: 0.5 },

  nextButtonText: {
    color: colors.textOnGold,
    fontSize: 16,
    fontWeight: 'bold',
  },

  content: {
    padding: 20,
    paddingBottom: 100,
  },

  bpmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  bpmButton: {
    backgroundColor: colors.indigo,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
  },

  summaryText: {
    color: colors.textSecondaryOnIndigo,
    marginBottom: 4,
  },
})
