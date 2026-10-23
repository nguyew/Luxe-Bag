import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/**
 * Khối "Hãy đăng nhập" hiện thay cho các màn cần tài khoản (Cart, Profile...)
 * khi người dùng còn là khách.
 */
export default function SignInPrompt({ icon = 'lock-closed-outline', title, message }) {
  const navigation = useNavigation();

  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={44} color="#77716A" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        onPress={() => navigation.navigate('Login')}
        style={styles.primary}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>Sign in</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Register')}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 90, // chừa chỗ cho tab bar nổi
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#0D0D0D',
  },
  message: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#77716A',
  },
  primary: {
    marginTop: 22,
    minWidth: 160,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  secondaryText: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
