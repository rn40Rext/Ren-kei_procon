import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home as HomeIcon, Camera, Users, User } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type BottomNavNavigationProp =
    NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function BottomNav() {
    const navigation = useNavigation<BottomNavNavigationProp>();
    const route = useRoute();

    return (
        <View style={styles.bottomNav}>
            <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigation.navigate('Home')}
            >
                <HomeIcon
                    size={24}
                    color={route.name === 'Home' ? "#eb2553" : '#9ca3af'} />
                <Text
                    style={[
                        styles.navText,
                        {
                            color: route.name === 'Home' ? '#eb2553' : '#9ca3af',
                        },
                    ]}
                >
                    ホーム
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigation.navigate('Scoring')}
            >
                <Camera
                    size={24}
                    color={route.name === 'Scoring' ? '#2563eb' : '#9ca3af'}
                />

                <Text
                    style={[
                        styles.navText,
                        {
                            color: route.name === 'Scoring'
                                ? '#2563eb'
                                : '#9ca3af',
                        },
                    ]}
                >
                    解析
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigation.navigate('Community')}
            >
                <Users
                    size={24}
                    color={route.name === 'Community' ? '#16a34a' : '#9ca3af'}
                />

                <Text
                    style={[
                        styles.navText,
                        {
                            color: route.name === 'Community' ? '#16a34a' : '#9ca3af',
                        },
                    ]}
                >
                    コミュニティ
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.navItem}
                onPress={() => navigation.navigate('Mypage')}
            >
                <User
                    size={24}
                    color={route.name === 'Mypage' ? '#4b5563' : '#9ca3af'}
                />

                <Text
                    style={[
                        styles.navText,
                        {
                            color: route.name === 'Mypage' ? '#4b5563' : '#9ca3af',
                        },
                    ]}
                >
                    マイページ
                </Text>
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
        paddingVertical: 10,
        paddingBottom: 24,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        justifyContent: 'space-around',
    },

    navItem: {
        alignItems: 'center',
    },

    navText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af',
        marginTop: 4,
    },
});