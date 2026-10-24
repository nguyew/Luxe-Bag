import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Tiêu đề lớn của các màn quản trị: tên màn, dòng phụ, và vùng nút bên phải. */
export default function AdminHeader({ title, subtitle, right }) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  texts: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.9, color: '#0D0D0D' },
  subtitle: { marginTop: 2, fontSize: 13, color: '#77716A' },
});
