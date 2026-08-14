import { View, Text } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';


type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;

export default function AnalysisScreen() {

    const route = useRoute<CameraScreenRouteProp>();
    const { danceType, scorePart } = route.params;

  return (
    <View>
      <Text>カメラ</Text>
    </View>
  );
}