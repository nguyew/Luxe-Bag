import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account details will appear here.</Text>
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