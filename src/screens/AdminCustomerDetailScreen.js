import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrderStatusBadge from '../components/OrderStatusBadge';
import useAdminUsers from '../hooks/useAdminUsers';
import { setCustomerStatus } from '../services/adminService';
import { customerStats } from '../utils/admin';
import { formatPrice } from '../utils/format';
import { formatOrderCode, formatOrderDate } from '../utils/orders';

/** Hồ sơ một khách hàng: thông tin, thống kê, đơn hàng và trạng thái tài khoản. */
export default function AdminCustomerDetailScreen({ navigation, route }) {
  const { userId } = route.params;
  const { users, reload } = useAdminUsers();
  const [busy, setBusy] = useState(false);

  const user = users ? users.find((item) => item.id === userId) : null;

  const toggle = useCallback(async () => {
    if (!user) return;
    const next = user.status === 'disabled' ? 'active' : 'disabled';
    setBusy(true);
    try {
      await setCustomerStatus(user.id, next);
      await reload();
    } catch {
      Alert.alert('Customer', 'Could not update this account. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [user, reload]);

  if (!user) {
    return (
      <View style={[styles.screen, styles.center]}>
        {users ? (
          <>
            <Ionicons name="person-outline" size={44} color="#77716A" />
            <Text style={styles.notFound}>Customer not found</Text>
          </>
        ) : (
          <ActivityIndicator color="#292725" />
        )}
      </View>
    );
  }

  const stats = customerStats(user);
  const disabled = user.status === 'disabled';
  const orders = [...user.orders].sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View style={[styles.avatar, disabled && styles.avatarOff]}>
            <Text style={styles.avatarText}>{(user.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headText}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
          <View style={[styles.statusPill, disabled ? styles.pillOff : styles.pillOn]}>
            <Text style={[styles.statusText, disabled ? styles.textOff : styles.textOn]}>
              {disabled ? 'Disabled' : 'Active'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user.phone || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Joined</Text>
          <Text style={styles.infoValue}>
            {user.createdAt ? formatOrderDate(user.createdAt) : '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Saved addresses</Text>
          <Text style={styles.infoValue}>{user.addresses.length}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.orderCount}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatPrice(stats.totalSpent)}</Text>
          <Text style={styles.statLabel}>Total spent</Text>
        </View>
      </View>

      <Pressable
        onPress={toggle}
        disabled={busy}
        style={[styles.toggle, disabled ? styles.toggleEnable : styles.toggleDisable, busy && styles.busy]}
        accessibilityRole="button"
        accessibilityLabel={disabled ? 'Enable account' : 'Disable account'}
      >
        {busy ? (
          <ActivityIndicator color={disabled ? '#FFFFFF' : '#B3261E'} />
        ) : (
          <>
            <Ionicons
              name={disabled ? 'lock-open-outline' : 'ban-outline'}
              size={18}
              color={disabled ? '#FFFFFF' : '#B3261E'}
            />
            <Text style={[styles.toggleText, !disabled && styles.toggleTextDanger]}>
              {disabled ? 'Enable account' : 'Disable account'}
            </Text>
          </>
        )}
      </Pressable>

      <Text style={styles.section}>Orders</Text>
      {orders.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.noOrders}>This customer hasn’t ordered yet.</Text>
        </View>
      ) : (
        orders.map((order) => (
          <Pressable
            key={order.id}
            onPress={() =>
              navigation.navigate('AdminOrderDetail', {
                order: {
                  ...order,
                  userId: user.id,
                  customerName: user.name,
                  customerEmail: user.email,
                },
              })
            }
            style={[styles.card, styles.orderCard]}
            accessibilityRole="button"
            accessibilityLabel={`Order ${formatOrderCode(order.id)}`}
          >
            <View style={styles.orderText}>
              <Text style={styles.orderId}>{formatOrderCode(order.id)}</Text>
              <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
            </View>
            <View style={styles.orderRight}>
              <OrderStatusBadge status={order.status} />
              <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 16, paddingBottom: 48 },
  card: { padding: 16, marginBottom: 10, borderRadius: 24, backgroundColor: '#FFFFFF' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOff: { backgroundColor: '#B9B2AA' },
  avatarText: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
  headText: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  email: { marginTop: 2, fontSize: 13, color: '#77716A' },
  statusPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  pillOn: { backgroundColor: '#DFF3E5' },
  pillOff: { backgroundColor: '#FBE3E1' },
  statusText: { fontSize: 11, fontWeight: '700' },
  textOn: { color: '#1F7A3E' },
  textOff: { color: '#B3261E' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#77716A' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },

  stats: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF' },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: '#0D0D0D' },
  statLabel: { marginTop: 2, fontSize: 12, color: '#77716A' },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    marginTop: 6,
    borderRadius: 25,
  },
  toggleDisable: { backgroundColor: '#FBE3E1' },
  toggleEnable: { backgroundColor: '#050505' },
  busy: { opacity: 0.7 },
  toggleText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  toggleTextDanger: { color: '#B3261E' },

  section: {
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  noOrders: { fontSize: 13, color: '#77716A', textAlign: 'center' },
  orderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderText: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3, color: '#0D0D0D' },
  orderDate: { marginTop: 2, fontSize: 12, color: '#77716A' },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  orderTotal: { fontSize: 15, fontWeight: '800', color: '#0D0D0D' },
});