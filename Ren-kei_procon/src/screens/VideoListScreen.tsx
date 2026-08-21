import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function VideoListScreen() {
    return (
        <View style={styles.container}>

            <Text>自分の上げた動画一覧</Text>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
})