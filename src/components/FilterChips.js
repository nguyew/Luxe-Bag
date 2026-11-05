import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

/**
 * Hàng chip lọc cuộn ngang.
 * options: [{ key, label, count? }]  –  value: key đang chọn  –  onChange(key)
 */
export default function FilterChips({ options, value, onChange, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.scroll, style]}
    >
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>
              {option.label}
              {option.count !== undefined ? ` ${option.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, height: 46 },
  row: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: '#050505' },
  text: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  textOn: { color: '#FFFFFF' },
});
