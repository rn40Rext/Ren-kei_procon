import React from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
type CameraScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {

    const route = useRoute<CameraScreenRouteProp>();
    const { danceType, scorePart } = route.params;
    const [permission, requestPermission] = useCameraPermissions();
    const navigation = useNavigation<CameraScreenNavigationProp>();

    if (!permission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ color: '#ffffff' }}>
                    カメラを使用するには許可が必要です
                </Text>

                <Button
                    title="カメラを許可する"
                    onPress={requestPermission}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>

            {/* カメラ */}
            <CameraView style={styles.camera} />

            {/* 下の情報 */}
            <View style={styles.info}>
                <Text style={styles.title}>
                    {danceType === 'male' ? '男踊り' : '女踊り'}
                </Text>

                <Text style={styles.part}>
                    {scorePart === 'feet'
                        ? '足だけ'
                        : scorePart === 'hands'
                            ? '手だけ'
                            : '全体'}
                </Text>

                <TouchableOpacity
                    style={styles.finishButton}
                    onPress={() => navigation.navigate('Result')}
                >
                    <Text style={styles.finishButtonText}>
                        採点終了
                    </Text>
                </TouchableOpacity>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },

    camera: {
        flex: 1,
    },

    info: {
        backgroundColor: '#ffffff',
        padding: 20,
        alignItems: 'center',
    },

    title: {
        fontSize: 22,
        fontWeight: 'bold',
    },

    part: {
        fontSize: 16,
        marginTop: 8,
        color: '#6b7280',
    },

    finishButton: {
        backgroundColor: '#2563eb',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },

    finishButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});