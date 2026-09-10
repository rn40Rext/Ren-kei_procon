import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Users, MapPin } from 'lucide-react-native';
import { functions } from '../config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import BottomNav from '../components/BottomNav';

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

// docs/design/data-model.md 3.8章
interface Ren {
  renId: string;
  name: string;
  description: string;
  location: string;
  memberCount: number;
}

export default function GroupScreen() {
  const [ren, setRen] = useState<Ren | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('エラー', '連の名前を入力してください');

    setCreating(true);
    try {
      const createRen = httpsCallable(functions, 'createRen');
      const result = await createRen({
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        beginnerFriendly,
      });
      const { renId } = result.data as { renId: string };
      setRen({
        renId,
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        memberCount: 1,
      });
      Alert.alert('完了', '連を作成しました');
    } catch (error) {
      console.error(error);
      Alert.alert('エラー', '連の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  if (ren) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.detailCard}>
            <Text style={styles.detailName}>{ren.name}</Text>
            {ren.description ? <Text style={styles.detailDescription}>{ren.description}</Text> : null}

            {ren.location ? (
              <View style={styles.detailRow}>
                <MapPin size={16} color={COLORS.textMuted} />
                <Text style={styles.detailRowText}>{ren.location}</Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Users size={16} color={COLORS.textMuted} />
              <Text style={styles.detailRowText}>メンバー {ren.memberCount}人</Text>
            </View>
          </View>
        </ScrollView>

        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.formContent}>
        <Text style={styles.title}>連を作成する</Text>
        <Text style={styles.subtitle}>所属する連がまだ無い場合、ここから新しく作成できます</Text>

        <Text style={styles.label}>連の名前</Text>
        <TextInput style={styles.input} placeholder="例：徳島連" value={name} onChangeText={setName} />

        <Text style={styles.label}>紹介</Text>
        <TextInput style={styles.textArea} placeholder="連の紹介文" value={description} onChangeText={setDescription} multiline />

        <Text style={styles.label}>活動地域</Text>
        <TextInput style={styles.input} placeholder="例：徳島県徳島市" value={location} onChangeText={setLocation} />

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setBeginnerFriendly(!beginnerFriendly)}>
          <View style={[styles.checkbox, beginnerFriendly && styles.checkboxChecked]} />
          <Text style={styles.checkboxLabel}>初心者歓迎</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>この内容で作成する</Text>}
        </TouchableOpacity>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  formContent: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 20 },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 20, minHeight: 80, textAlignVertical: 'top' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, marginRight: 10 },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxLabel: { fontSize: 14, color: COLORS.textMain },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  detailContent: { padding: 20, paddingBottom: 120 },
  detailCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 2 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  detailDescription: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16, lineHeight: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detailRowText: { marginLeft: 8, fontSize: 14, color: COLORS.textMain },
});
