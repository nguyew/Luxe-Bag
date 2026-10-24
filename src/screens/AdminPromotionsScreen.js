import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPromotions, updateCoupons } from '../services/promotionService';
import { couponStatus, describeCoupon } from '../utils/coupons';
import { formatOrderDate } from '../utils/orders';

const STATUS_META = {
  active: { label: 'Active', color: '#1F7A3E', bg: '#DFF3E5' },
  inactive: { label: 'Paused', color: '#55514C', bg: '#E7E3DF' },
  expired: { label: 'Expired', color: '#B3261E', bg: '#FBE3E1' },
  used_up: { label: 'Used up', color: '#8A5A00', bg: '#FFF1D6' },
};

/** Danh sách mã giảm giá: bật / tạm dừng, sửa, thêm mới. */
export default function AdminPromotionsScreen({ navigation }) {
  const [coupons, setCoupons] = useState(null); // null = đang tải
  const [error, setError] = useState('');
  const [pulling, setPulling] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setCoupons(await fetchPromotions());
      setError('');
    } catch {
      setError('Could not load discount codes.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await load();
    setPulling(false);
  }, [load]);

  const toggleActive = useCallback(async (coupon) => {
    setBusyId(coupon.id);
    try {
      const next = await updateCoupons((list) =>
        list.map((item) => (item.id === coupon.id ? { ...item, active: !coupon.active } : item))
      );
      setCoupons(next);
    } catch {
      Alert.alert('Discount codes', 'Could not update this code. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (coupons === null && !error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (coupons === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>{error}</Text>
        <Pressable onPress={load} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={coupons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Pressable
            onPress={() => navigation.navigate('AdminCouponForm')}
            style={styles.add}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addText}>New discount code</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="pricetag-outline" size={44} color="#77716A" />
            <Text style={styles.emptyTitle}>No discount codes yet</Text>
            <Text style={styles.emptyText}>Create one and customers can use it at checkout.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = couponStatus(item);
          const meta = STATUS_META[status];
          return (
            <Pressable
              onPress={() => navigation.navigate('AdminCouponForm', { couponId: item.id })}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Edit code ${item.code}`}
            >
              <View style={styles.top}>
                <View style={styles.topText}>
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.desc}>{describeCoupon(item)}</Text>
                </View>
                {busyId === item.id ? (
                  <ActivityIndicator color="#292725" />
                ) : (
                  <Switch
                    value={item.active}
                    onValueChange={() => toggleActive(item)}
                    trackColor={{ true: '#050505', false: '#D8D2CC' }}
                    accessibilityLabel={`${item.code} active`}
                  />
                )}
              </View>
              <View style={styles.bottom}>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.meta}>
                  Used {item.usedCount}
                  {item.usageLimit !== null ? `/${item.usageLimit}` : ''}
                  {item.expiresAt ? ` · until ${formatOrderDate(item.expiresAt)}` : ' · no expiry'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D', textAlign: 'center' },
  emptyText: { marginTop: 4, fontSize: 13, color: '#77716A', textAlign: 'center' },
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
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    marginBottom: 14,
    borderRadius: 25,
    backgroundColor: '#050505',
  },
  addText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  card: { padding: 16, marginBottom: 10, borderRadius: 22, backgroundColor: '#FFFFFF' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: { flex: 1 },
  code: { fontSize: 17, fontWeight: '800', letterSpacing: 0.8, color: '#0D0D0D' },
  desc: { marginTop: 2, fontSize: 13, color: '#55514C' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  badge: { paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { flex: 1, fontSize: 12, color: '#77716A' },
});
