import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function MypageScreen() {
  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.profile}>

        <Text style={styles.title}>マイページ</Text>

        <Text style={styles.normal}>名前：</Text>
        <Text style={styles.normal}>連：</Text>
        <Text style={styles.normal}>自己紹介</Text>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>プロフィールを編集</Text>
        </TouchableOpacity>

        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 20,
  },

  profile: {
    margin: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  normal: {
    fontSize: 16,
    marginBottom: 12,
  },

  editButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },

  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
})