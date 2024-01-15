import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import DaysList from './src/screens/DaysList';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <DaysList />
    </SafeAreaProvider>
  );
}
