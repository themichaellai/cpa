import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { IsoDate, useDays } from './src/store/days';

export default function App() {
  const [days, createDay] = useDays();
  const newDay = () => {
    createDay({
      day: new Date().toISOString().split('T')[0] as IsoDate,
      coffee: null,
      wakeUp: null,
      dinner: null,
      poops: [],
    });
  };
  return (
    <View style={styles.container}>
      <Text onPress={newDay}>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
      {days.map((day) => (
        <Text key={day.day}>{day.day}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
