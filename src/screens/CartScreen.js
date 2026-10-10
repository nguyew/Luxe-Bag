import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Bag</Text>
      <Text style={styles.subtitle}>Your bag is empty.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F1F1',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#77716A' },
});