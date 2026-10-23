import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Bắt lỗi khi vẽ giao diện ở bất kỳ màn hình nào. Thay vì app trắng xóa
 * hoặc văng ra ngoài, người dùng thấy thông báo và nút thử lại.
 */
export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.warn('UI error:', error, info?.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.box}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>
          The app ran into an unexpected problem. Your favorites are safe.
        </Text>
        <Pressable onPress={this.reset} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F3F1F1',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0D0D0D' },
  text: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#77716A',
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
