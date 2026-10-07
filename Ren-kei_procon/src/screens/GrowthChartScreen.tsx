/**
 * U-10 成長曲線(#37)。仕様書5章U-10 / 4章HIST-01、docs/design/screens.md。
 * analysisResults をユーザー横断で購読し、総合スコアの推移と項目別スコアの
 * 推移を表示する。書き込みはFN-01(サーバ)のみのため、ここは表示専用。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { AnalysisResult, subscribeAnalysisResultsByUser } from '../repositories/analysis';
import GrowthLineChart, { ChartPoint } from '../components/GrowthLineChart';
import { colors } from '../theme';
import ScreenHeader from '../components/ScreenHeader';

/** この画面で使う画面遷移の型 */
type Nav = NativeStackNavigationProp<RootStackParamList, 'GrowthChart'>;

// ResultScreen.tsx の ITEMS と表示名を揃える。総合に含まれる4項目のみ(TBD-05)。
// 並び順がそのまま「項目別の点数の推移」のカードの並び順になる。
const ITEM_DEFS: { key: 'handHeightScore' | 'hipHeightScore' | 'stopScore' | 'rhythmScore'; label: string; color: string }[] = [
  { key: 'handHeightScore', label: '手の高さ', color: colors.gold },
  { key: 'hipHeightScore', label: '腰の低さ', color: colors.goldBright },
  { key: 'stopScore', label: '手を止める', color: colors.aka },
  { key: 'rhythmScore', label: 'リズム', color: colors.success },
];

// 総合スコアをグラフの点に変換する。直前の記録から analysisVersion(採点基準)が
// 変わった点にだけ versionLabel を付けて、グラフ上に点線で区切りを出せるようにする
function toChartPoints(results: AnalysisResult[]): ChartPoint[] {
  return results.map((r, i) => ({
    value: r.totalScore,
    versionLabel: i > 0 && results[i - 1].analysisVersion !== r.analysisVersion ? r.analysisVersion : undefined,
  }));
}

/** 自分の極め度と項目別の点数が、稽古を重ねてどう変わったかをグラフで見る画面 */
export default function GrowthChartScreen() {
  const navigation = useNavigation<Nav>();
  const { uid } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [results, setResults] = useState<AnalysisResult[] | null>(null); // null=読み込み中 / 空配列=記録なし / 配列あり=表示できる(JSXの分岐がこの3状態に依存している)
  const [error, setError] = useState<string | null>(null);

  // 自分の解析結果(古い順)をリアルタイム購読する
  useEffect(() => {
    if (!uid) return;
    return subscribeAnalysisResultsByUser(uid, setResults, (e) => {
      console.error('成長記録の取得に失敗しました', e);
      setError('成長記録の取得に失敗しました。時間をおいて再度お試しください');
    });
  }, [uid]);

  // 極め度の推移グラフに渡す点
  const totalPoints = useMemo(() => (results ? toChartPoints(results) : []), [results]);

  // 画面の幅は最大600pxに抑える(広い画面でグラフが間延びしないように)。
  // contentWidth はスクロール領域の左右余白16pxずつ(合計32)を引いた幅、
  // chartWidth はさらにカード内の左右余白16pxずつ(合計32)を引いた、グラフ本体の幅
  const contentWidth = Math.min(windowWidth, 600) - 32;
  const chartWidth = contentWidth - 32;

  // 直近の記録・その前の記録・自己ベストの記録と、前回からの点数の差
  const latest = results && results.length > 0 ? results[results.length - 1] : null;
  const previous = results && results.length > 1 ? results[results.length - 2] : null;
  const best = results && results.length > 0 ? results.reduce((a, b) => (b.totalScore > a.totalScore ? b : a)) : null;
  const diff = latest && previous ? Math.round(latest.totalScore - previous.totalScore) : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー(共通): 稽古手帳へ戻るボタン・画面名・メニュー */}
      <ScreenHeader
        title="成長の記録"
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Mypage'))}
      />

      {/* 4つの表示状態: 読み込み中 / エラー / 記録なし / 記録あり */}
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
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 直近の極め度と前回比、自己ベスト */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>直近の極め度</Text>
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

          {/* 総合スコア(極め度)の推移グラフ */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>極め度の推移</Text>
            <GrowthLineChart points={totalPoints} width={chartWidth} height={140} />
            {results.length === 1 && <Text style={styles.noteText}>もう1回記録すると推移が見られます</Text>}
            {totalPoints.some((p) => p.versionLabel) && (
              <Text style={styles.noteText}>点線: 採点基準(analysisVersion)が変わった記録</Text>
            )}
          </View>

          {/* 項目別の推移。その項目のスコアが1件も無い項目はカードごと出さない。2列で並べる */}
          <Text style={styles.sectionLabel}>項目別の点数の推移</Text>
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

  // まだ記録が無いときに、中央に案内文とボタンだけを表示するエリア
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.textSecondary, fontSize: 14, marginBottom: 20, textAlign: 'center' },
  ctaBtn: { backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  ctaBtnText: { color: colors.textOnGold, fontWeight: 'bold' },

  // スクロール部分の余白(中身を中央に寄せる)
  content: { padding: 16, alignItems: 'center' },
  // 「直近スコア」「自己ベスト」の2枚のカードを横に並べる
  summaryRow: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 600 - 32 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.indigo,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  // 要約カードの見出し・大きな数字と、前回比の行(上がれば金、下がれば朱)
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginTop: 4 },
  diffRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  diffText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  // 総合スコアの折れ線グラフを囲むカード
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
  // グラフの見出しと、グラフの下の注記
  chartTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  noteText: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },

  // 「項目別の点数の推移」の見出し
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginTop: 24, marginBottom: 10, width: '100%', maxWidth: 600 - 32 },
  // 項目別(手の高さ等)のミニグラフを、折り返しながら横に並べる
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', maxWidth: 600 - 32 },
  itemCard: {
    backgroundColor: colors.indigo,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.indigoLine,
  },
  // 項目別カードの項目名と、直近の点数(項目ごとの色)
  itemLabel: { fontSize: 12, color: colors.textSecondary },
  itemValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2, marginBottom: 4 },
});
