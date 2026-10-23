import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';

export default function CartScreen() {
  const { isLoggedIn } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      {isLoggedIn ? (
        // Phase 2 sẽ thay phần này bằng giỏ hàng thật
        <View style={styles.empty}>
          <Text style={styles.title}>My Bag</Text>
          <Text style={styles.subtitle}>Your bag is empty.</Text>
        </View>
      ) : (
        <SignInPrompt
          icon="bag-handle-outline"
          title="Your bag"
          message="Sign in to add handbags to your bag and place orders."
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1F1' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#77716A' },
});
