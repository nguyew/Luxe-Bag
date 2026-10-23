import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuth from '../hooks/useAuth';
import useHandbags from '../hooks/useHandbags';
import { listUsers } from '../services/userService';

/**
 * Màn đầu tiên của khu quản trị (Phase 1: khung + số liệu cơ bản).
 * Các Phase sau sẽ thêm: quản lý sản phẩm, đơn hàng, khách hàng, báo cáo...
 */
export default function AdminHomeScreen() {
  const { user, logout } = useAuth();
  const { items } = useHandbags();
  const [customers, setCustomers] = useState(null); // null = đang tải

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((list) => {
        if (!cancelled) {
          setCustomers(list.filter((item) => item.role === 'customer').length);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomers(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmLogout = useCallback(() => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
          <Text style={styles.badgeText}>Admin</Text>
        </View>

        <Text style={styles.title}>Hello, {user?.name || 'admin'}.</Text>
        <Text style={styles.subtitle}>Manage the LuxeBag store.</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{customers === null ? '…' : customers}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </View>
        </View>

        <Pressable onPress={confirmLogout} style={styles.logout} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color="#B3261E" />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F1F1' },
  content: { padding: 20 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#050505',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  title: {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: '#0D0D0D',
  },
  subtitle: { marginTop: 4, fontSize: 14, color: '#77716A' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 24 },
  stat: {
    flex: 1,
    padding: 18,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  statValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, color: '#0D0D0D' },
  statLabel: { marginTop: 2, fontSize: 13, color: '#77716A' },
  logout: {
    marginTop: 28,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FBE3E1',
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: '#B3261E' },
});
