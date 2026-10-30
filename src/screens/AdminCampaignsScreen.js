import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  campaignStatus,
  describeCampaign,
  fetchAdminCampaigns,
  setCampaignActive,
} from '../services/campaignService';
import useHandbags from '../hooks/useHandbags';
import { showMessage } from '../utils/confirm';
import { formatBrand, formatCategory } from '../utils/format';
import { formatOrderDate } from '../utils/orders';

const STATUS_META = {
  active: { label: 'Active', color: '#1F7A3E', bg: '#DFF3E5' },
  inactive: { label: 'Paused', color: '#55514C', bg: '#E7E3DF' },
  expired: { label: 'Expired', color: '#B3261E', bg: '#FBE3E1' },
};

const labelFor = (scope, value) => (scope === 'brand' ? formatBrand(value) : formatCategory(value));

/** Danh sách promotion (giảm giá theo % cho cả cửa hàng / danh mục / thương hiệu). */
export default function AdminCampaignsScreen({ navigation }) {
  const { reload } = useHandbags();
  const [campaigns, setCampaigns] = useState(null); // null = đang tải
  const [error, setError] = useState('');
  const [pulling, setPulling] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setCampaigns(await fetchAdminCampaigns());
      setError('');
    } catch {
      setError('Could not load promotions.');
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

  const toggleActive = useCallback(
    async (campaign) => {
      setBusyId(campaign.id);
      try {
        const saved = await setCampaignActive(campaign.id, !campaign.active);
        setCampaigns((list) => list.map((item) => (item.id === saved.id ? saved : item)));
        reload(); // giá sản phẩm thay đổi theo promotion
      } catch {
        showMessage('Promotions', 'Could not update this promotion. Please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [reload]
  );

  if (campaigns === null && !error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (campaigns === null) {
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
        data={campaigns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Pressable
            onPress={() => navigation.navigate('AdminCampaignForm')}
            style={styles.add}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addText}>New promotion</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="megaphone-outline" size={44} color="#77716A" />
            <Text style={styles.emptyTitle}>No promotions yet</Text>
            <Text style={styles.emptyText}>
              Create one and the discounted price shows on matching products automatically.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[campaignStatus(item)];
          return (
            <Pressable
              onPress={() => navigation.navigate('AdminCampaignForm', { campaignId: item.id })}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Edit promotion ${item.name}`}
            >
              <View style={styles.top}>
                <View style={styles.topText}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.desc}>{describeCampaign(item, labelFor)}</Text>
                </View>
                {busyId === item.id ? (
                  <ActivityIndicator color="#292725" />
                ) : (
                  <Switch
                    value={item.active}
                    onValueChange={() => toggleActive(item)}
                    trackColor={{ true: '#050505', false: '#D8D2CC' }}
                    accessibilityLabel={`${item.name} active`}
                  />
                )}
              </View>
              <View style={styles.bottom}>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.meta}>
                  {item.expiresAt ? `Until ${formatOrderDate(item.expiresAt)}` : 'No expiry'}
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
  name: { fontSize: 16, fontWeight: '800', color: '#0D0D0D' },
  desc: { marginTop: 2, fontSize: 13, color: '#55514C' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  badge: { paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { flex: 1, fontSize: 12, color: '#77716A' },
});
