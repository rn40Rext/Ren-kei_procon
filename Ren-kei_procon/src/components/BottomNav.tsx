import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home as HomeIcon, Camera, Users, User } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { subscribeUnreadNotificationCount } from '../repositories/notifications';
import NotificationBadge from './NotificationBadge';

export default function BottomNav() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute();
    const { uid } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!uid) return;
        return subscribeUnreadNotificationCount(uid, setUnreadCount, () => undefined);
    }, [uid]);

    return (
        <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
                <View>
                    <HomeIcon size={24} color={route.name === 'Home' ? "#2563eb" : '#9ca3af'} />
                    <NotificationBadge count={unreadCount} dotOnly />
                </View>
                <Text style={[styles.navText, { color: route.name === 'Home' ? '#2563eb' : '#9ca3af' }]}>ホーム</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Scoring')}>
                <Camera size={24} color={route.name === 'Scoring' ? '#2563eb' : '#9ca3af'} />
                <Text style={[styles.navText, { color: route.name === 'Scoring' ? '#2563eb' : '#9ca3af' }]}>解析</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Community')}>
                <Users size={24} color={route.name === 'Community' ? '#2563eb' : '#9ca3af'} />
                <Text style={[styles.navText, { color: route.name === 'Community' ? '#2563eb' : '#9ca3af' }]}>広場</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Mypage')}>
                <User size={24} color={route.name === 'Mypage' ? '#2563eb' : '#9ca3af'} />
                <Text style={[styles.navText, { color: route.name === 'Mypage' ? '#2563eb' : '#9ca3af' }]}>マイページ</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    bottomNav: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingVertical: 10, paddingBottom: 24, position: 'absolute', bottom: 0, width: '100%', justifyContent: 'space-around' },
    navItem: { alignItems: 'center' },
    navText: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
});