import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { PURPLE } from '../../colors';
import { Dinner } from '../../store/days';

type DinnerSize = Dinner['size'];

const DinnerPicker: React.FC<{
  dinner: Dinner | null;
  setSize: (size: DinnerSize | null) => void;
}> = ({ dinner, setSize }) => {
  //const setSelected= useCallback((s: DinnerSize) => setSelectedState(currSize => currSize === s ? null : s), []);

  const buttonSelectedStyle = useCallback(
    (newSize: DinnerSize) =>
      dinner?.size === newSize ? styles.buttonSelected : null,
    [dinner?.size],
  );

  const selectRegular = useCallback(() => setSize('regular'), [setSize]);
  const selectBig = useCallback(() => setSize('big'), [setSize]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={selectRegular}
        style={[
          styles.button,
          styles.buttonLeft,
          styles.buttonWithBorderSeparator,
          buttonSelectedStyle('regular'),
        ]}
      >
        <Text size="sm">Regular</Text>
      </Pressable>
      <Pressable
        onPress={selectBig}
        style={[styles.button, styles.buttonRight, buttonSelectedStyle('big')]}
      >
        <Text size="sm">Big</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonLeft: {
    borderBottomLeftRadius: 9,
    borderTopLeftRadius: 9,
  },
  buttonRight: {
    borderBottomRightRadius: 9,
    borderTopRightRadius: 9,
  },
  buttonSelected: {
    backgroundColor: PURPLE.P8,
  },
  buttonWithBorderSeparator: {
    borderRightColor: PURPLE.P8,
    borderRightWidth: 1,
  },
  container: {
    borderColor: PURPLE.P8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
  },
});

export default memo(DinnerPicker);
