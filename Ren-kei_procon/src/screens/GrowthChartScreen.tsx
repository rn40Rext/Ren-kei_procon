/**
 * U-10 成長曲線(#37)。仕様書5章U-10 / 4章HIST-01、docs/design/screens.md。
 * analysisResults をユーザー横断で購読し、総合スコアの推移と項目別スコアの
 * 推移を表示する。書き込みはFN-01(サーバ)のみのため、ここは表示専用。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { AnalysisResult, subscribeAnalysisResultsByUser } from '../repositories/analysis';
import GrowthLineChart, { ChartPoint } from '../components/GrowthLineChart';
import { colors } from '../theme';
import AppMenu from '../components/AppMenu';

type Nav = NativeStackNavigationProp<RootStackParamList, 'GrowthChart'>;

// ResultScreen.tsx の ITEMS と表示名を揃える。総合に含まれる4項目のみ(TBD-05)。
const ITEM_DEFS: { key: 'handHeightScore' | 'hipHeightScore' | 'stopScore' | 'rhythmScore'; label: string; color: string }[] = [
  { key: 'handHeightScore', label: '手の高さ', color: colors.gold },
  { key: 'hipHeightScore', label: '腰の低さ', color: colors.goldBright },
  { key: 'stopScore', label: '手を止める', color: colors.aka },
  { key: 'rhythmScore', label: 'リズム', color: colors.success },
];

function toChartPoints(results: AnalysisResult[]): ChartPoint[] {
  return results.map((r, i) => ({
    value: r.totalScore,
    versionLabel: i > 0 && results[i - 1].analysisVersion !== r.analysisVersion ? r.analysisVersion : undefined,
  }));
}

export default function GrowthChartScreen() {
  const navigation = useNavigation<Nav>();
  const { uid } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeAnalysisResultsByUser(uid, setResults, (e) => {
      console.error('成長記録の取得に失敗しました', e);
      setError('成長記録の取得に失敗しました。時間をおいて再度お試しください');
    });
  }, [uid]);

  const totalPoints = useMemo(() => (results ? toChartPoints(results) : []), [results]);

  const contentWidth = Math.min(windowWidth, 600) - 32;
  const chartWidth = contentWidth - 32;

  const latest = results && results.length > 0 ? results[results.length - 1] : null;
  const previous = results && results.length > 1 ? results[results.length - 2] : null;
  const best = results && results.length > 0 ? results.reduce((a, b) => (b.totalScore > a.totalScore ? b : a)) : null;
  const diff = latest && previous ? Math.round(latest.totalScore - previous.totalScore) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Mypage'))}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>成長曲線</Text>
        <AppMenu />
      </View>

      {results === null && !error ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.gold} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : results && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>まだ記録がありません。稽古を始めましょう</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Scoring')}>
            <Text style={styles.ctaBtnText}>稽古を始める</Text>
          </TouchableOpacity>
        </View>
      ) : results ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>直近スコア</Text>
              <Text style={styles.summaryValue}>{Math.round(latest!.totalScore)}</Text>
              {diff !== null && (
                <View style={styles.diffRow}>
                  {diff > 0 ? (
                    <TrendingUp size={14} color={colors.gold} />
                  ) : diff < 0 ? (
                    <TrendingDown size={14} color={colors.aka} />
                  ) : (
                    <Minus size={14} color={colors.textSecondary} />
                  )}
                  <Text
                    style={[
                      styles.diffText,
                      diff > 0 ? { color: colors.gold } : diff < 0 ? { color: colors.aka } : undefined,
                    ]}
                  >
                    {diff > 0 ? `+${diff}` : diff} (前回比)
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>自己ベスト</Text>
              <Text style={styles.summaryValue}>{Math.round(best!.totalScore)}</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>総合スコアの推移</Text>
            <GrowthLineChart points={totalPoints} width={chartWidth} height={140} />
            {results.length === 1 && <Text style={styles.noteText}>もう1回記録すると推移が見られます</Text>}
            {totalPoints.some((p) => p.versionLabel) && (
              <Text style={styles.noteText}>点線: 採点基準(analysisVersion)が変わった記録</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>項目別スコアの推移</Text>
          <View style={styles.itemGrid}>
            {ITEM_DEFS.map((def) => {
              const itemResults = results.filter((r) => typeof r[def.key] === 'number');
              if (itemResults.length === 0) return null;
              const itemPoints: ChartPoint[] = itemResults.map((r) => ({ value: r[def.key] as number }));
              const itemLatest = Math.round(itemResults[itemResults.length - 1][def.key] as number);
              return (
                <View key={def.key} style={[styles.itemCard, { width: (chartWidth - 12) / 2 }]}>
                  <Text style={styles.itemLabel}>{def.label}</Text>
                  <Text style={[styles.itemValue, { color: def.color }]}>{itemLatest}</Text>
                  <GrowthLineChart points={itemPoints} width={(chartWidth - 12) / 2 - 24} height={56} color={def.color} showDots={false} />
                </View>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors.indigo,
    borderBottomWidth: 1,
    borderColor: colors.indigoLine,
  },
  backBtn: { padding: 4, width: 34 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.textSecondary, fontSize: 14, marginBottom: 20, textAlign: 'center' },
  ctaBtn: { backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  ctaBtnText: { color: colors.textOnGold, fontWeight: 'bold' },

  content: { padding: 16, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 600 - 32 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.indigo,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 },
  diffRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  diffText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  chartCard: {
    width: '100%',
    maxWidth: 600 - 32,
    backgroundColor: colors.indigo,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    marginTop: 16,
  },
  chartTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  noteText: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },

  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginTop: 24, marginBottom: 10, width: '100%', maxWidth: 600 - 32 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', maxWidth: 600 - 32 },
  itemCard: {
    backgroundColor: colors.indigo,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  itemLabel: { fontSize: 12, color: colors.textSecondary },
  itemValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2, marginBottom: 4 },
});
