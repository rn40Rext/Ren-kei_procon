import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type DanceType = "male" | "female";
type ScorePart = "feet" | "hands" | "whole";


export default function AnalysisScreen() {

  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [scorePart, setScorePart] = useState<ScorePart | null>(null);

  return (
    <View style={styles.container}>
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
        <Text>男踊り</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setDanceType('female')}
        style={[
          styles.danceButton,
          danceType === 'female' && styles.selectedButton,
        ]}
      >
        <Text>女踊り</Text>
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
        <Text>足だけ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setScorePart('hands')}
        style={[
          styles.danceButton,
          scorePart === 'hands' && styles.selectedButton,
        ]}
      >
        <Text>手だけ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setScorePart('whole')}
        style={[
          styles.danceButton,
          scorePart === 'whole' && styles.selectedButton,
        ]}
      >
        <Text>全体</Text>
      </TouchableOpacity>

      <Text>
        選択中の踊り：
        {danceType === 'male'
          ? '男踊り'
          : danceType === 'female'
            ? '女踊り'
            : '未選択'}
      </Text>

      <Text>
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
        style={styles.nextButton}
        onPress={() => {
          if (danceType === null || scorePart === null) {
            return;
          }

          console.log('踊り:', danceType);
          console.log('採点部分:', scorePart);
        }}
      >
        <Text style={styles.nextButtonText}>次へ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },

  danceButton: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  selectedButton: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },

  nextButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },

  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
})