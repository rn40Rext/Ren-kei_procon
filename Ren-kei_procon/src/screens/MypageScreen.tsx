import { View, Text } from 'react-native';
import BottomNav from '../components/BottomNav';

export default function AnalysisScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Text>マイページ</Text>

      <BottomNav />
    </View>
  );
}