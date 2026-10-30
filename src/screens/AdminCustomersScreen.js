import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminHeader from '../components/AdminHeader';
import FilterChips from '../components/FilterChips';
import SearchBox from '../components/SearchBox';
import useAdminUsers from '../hooks/useAdminUsers';
import { customerStats } from '../utils/admin';
import { formatPrice } from '../utils/format';

/** Danh sách khách hàng: tìm theo tên/email, lọc đang hoạt động / đã khóa. */
export default function AdminCustomersScreen({ navigation }) {
  const { users, loading, error, reload } = useAdminUsers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pulling, setPulling] = useState(false);

  const customers = useMemo(
    () => (users ? users.filter((user) => user.role === 'customer') : []),
    [users]
  );
  const disabledCount = customers.filter((user) => user.status === 'disabled').length;

  const options = useMemo(
    () => [
      { key: 'all', label: 'All', count: customers.length },
      { key: 'active', label: 'Active', count: customers.length - disabledCount },
      { key: 'disabled', label: 'Disabled', count: disabledCount },
    ],
    [customers.length, disabledCount]
  );

  const data = useMemo(() => {
    const text = query.trim().toLowerCase();
    return customers
      .filter((user) => filter === 'all' || user.status === filter)
      .filter(
        (user) =>
          !text ||
          user.name.toLowerCase().includes(text) ||
          user.email.toLowerCase().includes(text)
      )
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }, [customers, filter, query]);

  const open = useCallback(
    (user) => navigation.navigate('AdminCustomerDetail', { userId: user.id }),
    [navigation]
  );

  const onRefresh = useCallback(async () => {
    setPulling(true);
    await reload();
    setPulling(false);
  }, [reload]);

  const renderItem = useCallback(({ item }) => <CustomerRow user={item} onPress={open} />, [open]);

  const empty = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color="#292725" />
    </View>
  ) : error && !users ? (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>Couldn’t load customers</Text>
      <Pressable onPress={reload} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <Ionicons name="people-outline" size={44} color="#77716A" />
      <Text style={styles.emptyTitle}>No customers found</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <AdminHeader title="Customers" subtitle={`${customers.length} registered accounts`} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search name or email" />
      <FilterChips options={options} value={filter} onChange={setFilter} />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={7}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}

const CustomerRow = React.memo(function CustomerRow({ user, onPress }) {
  const stats = customerStats(user);
  const disabled = user.status === 'disabled';

  return (
    <Pressable
      onPress={() => onPress(user)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${user.name}, ${disabled ? 'disabled' : 'active'}`}
    >
      <View style={[styles.avatar, disabled && styles.avatarOff]}>
        {typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '' ? (
          <Image
            source={{ uri: user.avatarUrl.trim() }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>
            {(user.name || '?').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name}
          </Text>
          {disabled && (
            <View style={styles.offBadge}>
              <Text style={styles.offText}>Disabled</Text>
            </View>
          )}
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {user.email}
        </Text>
        <Text style={styles.stats}>
          {stats.orderCount} {stats.orderCount === 1 ? 'order' : 'orders'} ·{' '}
          {formatPrice(stats.totalSpent)} spent
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B9B2AA" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F1F1' },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOff: { backgroundColor: '#B9B2AA' },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  offBadge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FBE3E1',
    justifyContent: 'center',
  },
  offText: { fontSize: 10, fontWeight: '700', color: '#B3261E' },
  email: { marginTop: 1, fontSize: 12, color: '#77716A' },
  stats: { marginTop: 4, fontSize: 12, color: '#55514C' },
});
