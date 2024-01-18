import { ComponentProps, memo, ReactNode, useMemo } from 'react';
import { Text as RNText, StyleSheet, TextStyle } from 'react-native';

type TextProps = Pick<ComponentProps<typeof RNText>, 'style' | 'onPress'>;

const Text: React.FC<
  {
    children?: ReactNode;
    size: 'sm' | 'md' | 'lg';
  } & TextProps
> = ({ children, size, style: customStyle, ...restProps }) => {
  const stylesArr = useMemo(() => {
    const sizeStyle = ((): TextStyle => {
      switch (size) {
        case 'sm':
          return styles.sm;
        case 'md':
          return styles.md;
        case 'lg':
          return styles.lg;
      }
    })();
    return [sizeStyle, customStyle];
  }, [customStyle, size]);
  return (
    <RNText style={stylesArr} {...restProps}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  lg: {
    fontSize: 24,
  },
  md: {
    fontSize: 20,
  },
  sm: {
    fontSize: 16,
  },
});

export default memo(Text);
