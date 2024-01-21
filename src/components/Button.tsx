import { ComponentProps, memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import Text from './Text';
import { PURPLE } from '../colors';

type Props = {
  label: string;
} & Pick<ComponentProps<typeof Pressable>, 'onPress'>;

const Button: React.FC<Props> = ({ label, ...restProps }) => {
  return (
    <Pressable style={styles.container} {...restProps}>
      <Text size="sm">{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PURPLE.P9,
    borderColor: PURPLE.P8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});

export default memo(Button);
