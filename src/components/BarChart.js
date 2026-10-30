import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCompactPrice, formatPrice } from '../utils/format';

const CHART_HEIGHT = 140;

/**
 * Biểu đồ cột đơn giản (không cần thư viện ngoài).
 * data: [{ label, value }]. Cột cao nhất được ghi giá trị phía trên.
 */
export default function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 0);
  const showEvery = data.length > 12 ? 3 : data.length > 8 ? 2 : 1; // thưa nhãn khi nhiều cột

  if (data.length === 0 || max === 0) {
    return (
      <View style={[styles.empty, { height: CHART_HEIGHT }]}>
        <Text style={styles.emptyText}>No sales in this period</Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={`Revenue chart, highest ${formatPrice(max)}`}>
      <View style={[styles.plot, { height: CHART_HEIGHT }]}>
        {data.map((item, index) => {
          const isMax = item.value === max;
          const height = Math.max((item.value / max) * (CHART_HEIGHT - 22), item.value > 0 ? 4 : 0);
          return (
            <View key={`${item.label}-${index}`} style={styles.col}>
              <Text style={styles.value} numberOfLines={1}>
                {isMax ? formatCompactPrice(item.value) : ''}
              </Text>
              <View style={[styles.bar, { height }, isMax && styles.barMax]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((item, index) => (
          <Text key={`${item.label}-${index}`} style={styles.label} numberOfLines={1}>
            {index % showEvery === 0 ? item.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#77716A' },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: 10, fontWeight: '700', color: '#0D0D0D', marginBottom: 2 },
  bar: { width: '100%', borderRadius: 6, backgroundColor: '#C9C2BA' },
  barMax: { backgroundColor: '#050505' },
  labels: { flexDirection: 'row', gap: 4, marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 10, color: '#77716A' },
});
