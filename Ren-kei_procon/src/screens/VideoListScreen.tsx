import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

export default function VideoListScreen() {
    return (
        <View style={styles.container}>

            <Text style={styles.text}>自分の上げた動画一覧</Text>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.indigoDeep,
    },
    text: {
        color: colors.textPrimaryOnIndigo,
        padding: 20,
    },
})
