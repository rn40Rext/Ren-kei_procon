import { View, Text, StyleSheet } from 'react-native';
import AppMenu from '../components/AppMenu';
import { colors, spacing } from '../theme';

export default function ConatctInfoScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.text}>連絡先一覧</Text>
                <AppMenu />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.indigoDeep,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderColor: colors.indigoLine,
    },
    text: {
        color: colors.textPrimaryOnIndigo,
    },
})
