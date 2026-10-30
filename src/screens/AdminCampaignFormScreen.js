import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthField from '../components/AuthField';
import useHandbags from '../hooks/useHandbags';
import {
  MAX_PERCENT_OFF,
  createCampaign,
  deleteCampaign,
  fetchAdminCampaigns,
  updateCampaign,
} from '../services/campaignService';
import { confirmAction, showMessage } from '../utils/confirm';
import { facetOptions } from '../utils/filters';
import { formatBrand, formatCategory } from '../utils/format';
import { formatOrderDate } from '../utils/orders';

const SCOPES = [
  { key: 'all', label: 'All products' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
];

const EXPIRY_CHOICES = [
  { key: 'none', label: 'No expiry' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

// Hết hạn vào cuối ngày thứ n kể từ hôm nay
function expiryFromDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

// Backend yêu cầu id dạng "pr-xxxx"
const newId = () => `pr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Thêm mới / sửa một promotion (route.params.campaignId = sửa). */
export default function AdminCampaignFormScreen({ navigation, route }) {
  const campaignId = route.params?.campaignId;
  const editing = !!campaignId;
  const { allItems, reload } = useHandbags();

  const [loaded, setLoaded] = useState(!editing);
  const [failed, setFailed] = useState(false);
  const [existing, setExisting] = useState(null);

  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [scope, setScope] = useState('all');
  const [targetValue, setTargetValue] = useState('');
  const [expiry, setExpiry] = useState('none'); // 'none' | '7' | '30' | '90' | 'keep'
  const [active, setActive] = useState(true);

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const brands = useMemo(() => facetOptions(allItems, 'brand'), [allItems]);
  const categories = useMemo(() => facetOptions(allItems, 'category'), [allItems]);
  const targetOptions = scope === 'brand' ? brands : scope === 'category' ? categories : [];
  const targetLabel = (value) => (scope === 'brand' ? formatBrand(value) : formatCategory(value));

  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    fetchAdminCampaigns()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((item) => item.id === campaignId);
        if (found) {
          setExisting(found);
          setName(found.name);
          setPercent(String(Math.round(found.percentOff * 10000) / 100));
          setScope(found.scope);
          setTargetValue(found.targetValue);
          setExpiry(found.expiresAt ? 'keep' : 'none');
          setActive(found.active);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, editing]);

  const chooseScope = (next) => {
    setScope(next);
    setTargetValue(''); // đổi phạm vi thì chọn lại đối tượng
  };

  const submit = useCallback(async () => {
    if (busy) return;

    const next = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      next.name = 'Use 2–120 characters.';
    }

    const amount = Number(percent.trim().replace(',', '.'));
    if (!percent.trim() || !Number.isFinite(amount) || amount <= 0) {
      next.percent = 'Enter a discount above 0.';
    } else if (amount > MAX_PERCENT_OFF) {
      next.percent = `The maximum discount is ${MAX_PERCENT_OFF}%.`;
    }

    if (scope !== 'all' && !targetValue) {
      next.target = scope === 'brand' ? 'Choose a brand.' : 'Choose a category.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let expiresAt = null;
    if (expiry === 'keep') expiresAt = existing?.expiresAt || null;
    else if (expiry !== 'none') expiresAt = expiryFromDays(Number(expiry));

    const data = {
      name: trimmedName,
      percentOff: Math.round(amount * 100) / 10000, // 15 -> 0.15
      scope,
      targetValue,
      expiresAt,
      active,
    };

    setBusy(true);
    try {
      if (editing) await updateCampaign(campaignId, data);
      else await createCampaign({ id: newId(), ...data });
      reload(); // giá sản phẩm thay đổi theo promotion
      navigation.goBack();
    } catch (e) {
      setBusy(false);
      showMessage('Promotion', e?.message || 'Could not save the promotion. Please try again.');
    }
  }, [busy, name, percent, scope, targetValue, expiry, active, existing, editing, campaignId, reload, navigation]);

  const remove = useCallback(() => {
    confirmAction({
      title: 'Delete this promotion?',
      message: 'Prices go back to normal for the products it covered.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCampaign(campaignId);
          reload();
          navigation.goBack();
        } catch {
          setBusy(false);
          showMessage('Promotion', 'Could not delete the promotion. Please try again.');
        }
      },
    });
  }, [campaignId, reload, navigation]);

  if (!loaded) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  if (failed || (editing && !existing)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={44} color="#77716A" />
        <Text style={styles.notFound}>{failed ? 'Couldn’t load the promotion' : 'Promotion not found'}</Text>
      </View>
    );
  }

  const expiryOptions = existing?.expiresAt
    ? [{ key: 'keep', label: `Keep (${formatOrderDate(existing.expiresAt)})` }, ...EXPIRY_CHOICES]
    : EXPIRY_CHOICES;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthField
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Autumn sale"
          autoCapitalize="sentences"
          maxLength={120}
        />
        <AuthField
          label={`Discount (%, up to ${MAX_PERCENT_OFF})`}
          value={percent}
          onChangeText={setPercent}
          error={errors.percent}
          placeholder="10"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Applies to</Text>
        <View style={styles.segment}>
          {SCOPES.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => chooseScope(option.key)}
              style={[styles.segmentItem, scope === option.key && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: scope === option.key }}
            >
              <Text style={[styles.segmentText, scope === option.key && styles.segmentTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {scope !== 'all' && (
          <>
            <Text style={styles.label}>{scope === 'brand' ? 'Brand' : 'Category'}</Text>
            <View style={styles.wrap}>
              {targetOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setTargetValue(option.value)}
                  style={[styles.chip, targetValue === option.value && styles.segmentOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: targetValue === option.value }}
                >
                  <Text style={[styles.segmentText, targetValue === option.value && styles.segmentTextOn]}>
                    {targetLabel(option.value)} ({option.count})
                  </Text>
                </Pressable>
              ))}
              {targetOptions.length === 0 && (
                <Text style={styles.hint}>No {scope === 'brand' ? 'brands' : 'categories'} found yet.</Text>
              )}
            </View>
            {!!errors.target && <Text style={styles.error}>{errors.target}</Text>}
          </>
        )}

        <Text style={styles.label}>Expires</Text>
        <View style={styles.wrap}>
          {expiryOptions.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setExpiry(option.key)}
              style={[styles.chip, expiry === option.key && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: expiry === option.key }}
            >
              <Text style={[styles.segmentText, expiry === option.key && styles.segmentTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ true: '#050505', false: '#D8D2CC' }}
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.busy]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Create promotion'}</Text>
          )}
        </Pressable>

        {editing && (
          <Pressable onPress={remove} disabled={busy} style={styles.danger} accessibilityRole="button">
            <Ionicons name="trash-outline" size={18} color="#B3261E" />
            <Text style={styles.dangerText}>Delete promotion</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 20, paddingBottom: 56 },
  label: { marginTop: 4, marginBottom: 8, marginLeft: 4, fontSize: 13, fontWeight: '600', color: '#55514C' },
  hint: { fontSize: 13, color: '#77716A', marginLeft: 4 },
  error: { marginTop: -10, marginBottom: 14, marginLeft: 4, fontSize: 12, color: '#B3261E' },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segmentItem: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: '#050505' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  segmentTextOn: { color: '#FFFFFF' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 22,
  },
  switchLabel: { fontSize: 15, color: '#1A1A1A' },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.7 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  danger: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    marginTop: 18,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: '#FBE3E1',
  },
  dangerText: { fontSize: 14, fontWeight: '700', color: '#B3261E' },
});
