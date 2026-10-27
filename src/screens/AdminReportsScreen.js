import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarChart from '../components/BarChart';
import FilterChips from '../components/FilterChips';
import useAdminUsers from '../hooks/useAdminUsers';
import { buildReport, flattenOrders } from '../utils/admin';
import { formatBrand, formatPrice } from '../utils/format';
import { ORDER_STATUS } from '../utils/orders';

const PERIODS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

/** Báo cáo doanh số: doanh thu theo thời gian, sản phẩm / thương hiệu bán chạy, tình trạng đơn. */
export default function AdminReportsScreen() {
  const { users, loading, error, reload } = useAdminUsers();
  const [period, setPeriod] = useState('30');
  const [pulling, setPulling] = useState(false);

  const days = PERIODS.find((item) => item.key === period).days;

  const report = useMemo(
    () => (users ? buildReport(flattenOrders(users), { days }) : null),
    [users, days]
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>{error || 'No data'}</Text>
        <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const maxProduct = Math.max(...report.topProducts.map((item) => item.revenue), 1);
  const maxBrand = Math.max(...report.byBrand.map((item) => item.revenue), 1);
  const statusRows = Object.keys(ORDER_STATUS).filter((key) => report.statusCounts[key]);

  const kpis = [
    { label: 'Revenue', value: formatPrice(report.revenue) },
    { label: 'Orders', value: String(report.orderCount) },
    { label: 'Avg. order', value: formatPrice(report.avgOrder) },
    { label: 'Refunded', value: formatPrice(report.refunded), sub: `${report.returned} returned` },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
    >
      <FilterChips
        options={PERIODS.map(({ key, label }) => ({ key, label }))}
        value={period}
        onChange={setPeriod}
      />

      <View style={styles.kpis}>
        {kpis.map((item) => (
          <View key={item.label} style={styles.kpi}>
            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
              {item.value}
            </Text>
            <Text style={styles.kpiLabel}>{item.label}</Text>
            {!!item.sub && <Text style={styles.kpiSub}>{item.sub}</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.section}>Revenue</Text>
      <View style={styles.card}>
        <BarChart data={report.series} />
        <Text style={styles.note}>Excludes cancelled and returned orders.</Text>
      </View>

      <Text style={styles.section}>Top products</Text>
      <View style={styles.card}>
        {report.topProducts.length === 0 ? (
          <Text style={styles.muted}>No sales in this period.</Text>
        ) : (
          report.topProducts.map((item, index) => (
            <View key={item.handbagId} style={styles.rankRow}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.rankBody}>
                <View style={styles.rankTop}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rankValue}>{formatPrice(item.revenue)}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(item.revenue / maxProduct) * 100}%` }]} />
                </View>
                <Text style={styles.rankSub}>
                  {item.qty} sold{item.brand ? ` · ${formatBrand(item.brand)}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.section}>By brand</Text>
      <View style={styles.card}>
        {report.byBrand.length === 0 ? (
          <Text style={styles.muted}>No sales in this period.</Text>
        ) : (
          report.byBrand.map((item) => (
            <View key={item.brand} style={styles.brandRow}>
              <View style={styles.rankTop}>
                <Text style={styles.rankName}>{formatBrand(item.brand)}</Text>
                <Text style={styles.rankValue}>{formatPrice(item.revenue)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(item.revenue / maxBrand) * 100}%` }]} />
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.section}>Orders by status</Text>
      <View style={styles.card}>
        {statusRows.length === 0 ? (
          <Text style={styles.muted}>No orders in this period.</Text>
        ) : (
          statusRows.map((key) => (
            <View key={key} style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: ORDER_STATUS[key].color }]} />
              <Text style={styles.statusLabel}>{ORDER_STATUS[key].label}</Text>
              <Text style={styles.statusCount}>{report.statusCounts[key]}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 14, paddingBottom: 48 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: '#0D0D0D', textAlign: 'center' },
  retry: {
    height: 42,
    marginTop: 16,
    paddingHorizontal: 24,
    borderRadius: 21,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  kpi: { flexBasis: '47%', flexGrow: 1, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF' },
  kpiValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: '#0D0D0D' },
  kpiLabel: { marginTop: 2, fontSize: 12, color: '#77716A' },
  kpiSub: { marginTop: 2, fontSize: 11, color: '#9A948D' },
  section: {
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 20,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  card: { marginHorizontal: 16, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF' },
  note: { marginTop: 10, fontSize: 11, color: '#9A948D' },
  muted: { fontSize: 13, color: '#77716A', textAlign: 'center' },
  rankRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rank: { width: 20, fontSize: 15, fontWeight: '800', color: '#9A948D' },
  rankBody: { flex: 1 },
  rankTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  rankName: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  rankValue: { fontSize: 13, fontWeight: '800', color: '#0D0D0D' },
  rankSub: { marginTop: 4, fontSize: 11, color: '#77716A' },
  brandRow: { marginBottom: 14 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#F3F1F1', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#050505' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  statusCount: { fontSize: 14, fontWeight: '800', color: '#0D0D0D' },
});