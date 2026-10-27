import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminHeader from '../components/AdminHeader';
import useAdminUsers from '../hooks/useAdminUsers';
import useAuth from '../hooks/useAuth';
import useHandbags from '../hooks/useHandbags';
import { flattenOrders, inventoryStats, salesSummary } from '../utils/admin';
import { formatPrice } from '../utils/format';

const MANAGE_LINKS = [
  { route: 'AdminReports', label: 'Sales report', icon: 'bar-chart-outline' },
  { route: 'AdminReviews', label: 'Review moderation', icon: 'chatbubble-ellipses-outline' },
  { route: 'AdminPromotions', label: 'Discount codes', icon: 'pricetag-outline' },
  { route: 'AdminTaxonomy', label: 'Brands & categories', icon: 'layers-outline' },
];

/** Dashboard quản trị: số liệu nhanh, bấm vào để tới màn tương ứng. */
export default function AdminHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { allItems, revalidate } = useHandbags();
  const { users, reload } = useAdminUsers();

  useFocusEffect(
    useCallback(() => {
      revalidate();
    }, [revalidate])
  );

  const inventory = inventoryStats(allItems);
  const sales = users ? salesSummary(flattenOrders(users)) : null;
  const customers = users ? users.filter((item) => item.role === 'customer') : null;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      Alert.alert('Unable to sign out', 'Please try again.');
    }
  };

  const cards = [
    {
      key: 'pending',
      icon: 'time-outline',
      label: 'Pending orders',
      value: sales ? sales.pending : '…',
      tone: sales && sales.pending > 0 ? 'warn' : 'normal',
      onPress: () => navigation.navigate('AdminOrders'),
    },
    {
      key: 'returns',
      icon: 'return-up-back-outline',
      label: 'Return requests',
      value: sales ? sales.returns : '…',
      tone: sales && sales.returns > 0 ? 'warn' : 'normal',
      onPress: () => navigation.navigate('AdminOrders', { filter: 'returns', t: Date.now() }),
    },
    {
      key: 'revenue',
      icon: 'cash-outline',
      label: 'Revenue',
      value: sales ? formatPrice(sales.revenue) : '…',
      hint: 'Excludes cancelled',
      onPress: () => navigation.navigate('AdminOrders'),
    },
    {
      key: 'orders',
      icon: 'receipt-outline',
      label: 'Total orders',
      value: sales ? sales.orderCount : '…',
      onPress: () => navigation.navigate('AdminOrders'),
    },
    {
      key: 'customers',
      icon: 'people-outline',
      label: 'Customers',
      value: customers ? customers.length : '…',
      onPress: () => navigation.navigate('AdminCustomers'),
    },
    {
      key: 'products',
      icon: 'pricetags-outline',
      label: 'Products',
      value: inventory.total,
      hint: `${inventory.published} published · ${inventory.draft} draft`,
      onPress: () => navigation.navigate('AdminProducts'),
    },
    {
      key: 'stock',
      icon: 'alert-circle-outline',
      label: 'Low / out of stock',
      value: `${inventory.lowStock} / ${inventory.outOfStock}`,
      tone: inventory.lowStock + inventory.outOfStock > 0 ? 'warn' : 'normal',
      onPress: () => navigation.navigate('AdminProducts'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AdminHeader
          title={`Hello, ${user?.name || 'admin'}.`}
          subtitle="Here’s how the store is doing."
          right={
            <Pressable
              onPress={handleLogout}
              style={styles.logout}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={20} color="#B3261E" />
            </Pressable>
          }
        />

        <View style={styles.grid}>
          {cards.map((card) => (
            <Pressable
              key={card.key}
              onPress={card.onPress}
              style={[styles.card, card.tone === 'warn' && styles.cardWarn]}
              accessibilityRole="button"
              accessibilityLabel={`${card.label}: ${card.value}`}
            >
              <Ionicons
                name={card.icon}
                size={20}
                color={card.tone === 'warn' ? '#8A5A00' : '#77716A'}
              />
              <Text style={styles.value}>{card.value}</Text>
              <Text style={styles.label}>{card.label}</Text>
              {!!card.hint && <Text style={styles.hint}>{card.hint}</Text>}
            </Pressable>
          ))}
        </View>

        <Text style={styles.manageTitle}>Manage</Text>
        <View style={styles.manage}>
          {MANAGE_LINKS.map((link, index) => (
            <Pressable
              key={link.route}
              onPress={() => navigation.navigate(link.route)}
              style={[styles.manageRow, index < MANAGE_LINKS.length - 1 && styles.manageDivider]}
              accessibilityRole="button"
            >
              <View style={styles.manageIcon}>
                <Ionicons name={link.icon} size={18} color="#1A1A1A" />
              </View>
              <Text style={styles.manageLabel}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#B9B2AA" />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={reload} style={styles.refresh} accessibilityRole="button">
          <Ionicons name="refresh" size={16} color="#1A1A1A" />
          <Text style={styles.refreshText}>Refresh data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  manageTitle: {
    marginTop: 26,
    marginBottom: 10,
    marginHorizontal: 24,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  manage: {
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  manageDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4DFDA' },
  manageIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  safeArea: { flex: 1, backgroundColor: '#F3F1F1' },
  content: { paddingBottom: 32 },
  logout: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBE3E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  cardWarn: { backgroundColor: '#FFF1D6' },
  value: { marginTop: 10, fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#0D0D0D' },
  label: { marginTop: 2, fontSize: 13, color: '#55514C' },
  hint: { marginTop: 4, fontSize: 11, color: '#77716A' },
  refresh: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    marginTop: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  refreshText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
});
