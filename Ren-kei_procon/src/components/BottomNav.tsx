import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Users, Sparkles, UserCircle } from 'lucide-react-native';

export default function BottomNav({ activeTab, navigation }: any) {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation?.navigate?.('Home')}
      >
        <Home size={20} color={activeTab === 'home' ? '#2563eb' : '#6b7280'} />
        <Text style={[styles.navText, activeTab === 'home' && styles.activeNavText]}>ホーム</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation?.navigate?.('Community')}
      >
        <Users size={20} color={activeTab === 'community' ? '#2563eb' : '#6b7280'} />
        <Text style={[styles.navText, activeTab === 'community' && styles.activeNavText]}>交流広場</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation?.navigate?.('Practice')}
      >
        <Sparkles size={20} color={activeTab === 'practice' ? '#2563eb' : '#6b7280'} />
        <Text style={[styles.navText, activeTab === 'practice' && styles.activeNavText]}>AI練習</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation?.navigate?.('Profile')}
      >
        <UserCircle size={20} color={activeTab === 'profile' ? '#2563eb' : '#6b7280'} />
        <Text style={[styles.navText, activeTab === 'profile' && styles.activeNavText]}>マイページ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingBottom: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  navText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 3,
  },
  activeNavText: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
});