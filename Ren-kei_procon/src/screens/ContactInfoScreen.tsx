import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function ConatctInfoScreen() {
    return (
        <View style={styles.container}>

            <Text>連絡先一覧</Text>

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