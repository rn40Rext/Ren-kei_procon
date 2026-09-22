import { View, Text, StyleSheet } from 'react-native';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

export default function SettingScreen() {
    return (
        <View style={styles.container}>

            <Text style={styles.text}>設定ページ</Text>

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
