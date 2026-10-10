
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LUXE BAG</Text>
      <Text>Discover your style</Text>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Detail')}
      >
        Open handbag details →
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#1A1A1A',
  },
  link: {
    marginTop: 24,
    color: '#9B7B3D',
  },
});
