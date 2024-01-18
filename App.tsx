import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import DaysList from './src/screens/DaysList';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex1}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <DaysList />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    backgroundColor: '#fff',
    flex: 1,
  },
});
