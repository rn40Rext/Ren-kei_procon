import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function RequestScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>指導リクエスト</Text>
        <Text style={styles.text}>この機能は準備中です</Text>
      </View>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  text: { fontSize: 14, color: '#64748B' },
});
