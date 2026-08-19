import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function GroupScreen() {
    return (
        <View style={styles.container}>

            <Text>所属している連のグループ</Text>

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