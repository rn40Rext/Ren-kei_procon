import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Video, Users, UsersRound, ChevronRight } from 'lucide-react-native';
import BottomNav from '../components/BottomNav';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MypageScreen() {

  const navigation = useNavigation<NavigationProp>();

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

          <View style={styles.menuContainer}>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.navigate('VideoList')}
            >
              <View style={styles.menuLeft}>
                <Video size={24} />
                <Text style={styles.menuText}>動画一覧</Text>
              </View>
              <ChevronRight size={24} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.navigate('ContactInfo')}
            >
              <View style={styles.menuLeft}>
                <Users size={24} />
                <Text style={styles.menuText}>連絡先一覧</Text>
              </View>
              <ChevronRight size={24} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.navigate('Group')}
            >
              <View style={styles.menuLeft}>
                <UsersRound size={24} />
                <Text style={styles.menuText}>グループ一覧</Text>
              </View>
              <ChevronRight size={24} />
            </TouchableOpacity>

          </View>

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

  menuContainer: {
    marginTop: 10,
  },

  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  menuText: {
    fontSize: 16,
    fontWeight: '600',
  },
})