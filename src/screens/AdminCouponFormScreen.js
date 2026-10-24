import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fetchPromotions, updateCoupons } from '../services/promotionService';
import { normalizeCode } from '../utils/coupons';
import { formatOrderDate } from '../utils/orders';

const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;
const EXPIRY_CHOICES = [
  { key: 'none', label: 'No expiry' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

const toNumber = (text) => Number(String(text).trim().replace(',', '.'));

// Hết hạn vào cuối ngày thứ n kể từ hôm nay
function expiryFromDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

const newId = () => `cp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Thêm mới / sửa một mã giảm giá (route.params.couponId = sửa). */
export default function AdminCouponFormScreen({ navigation, route }) {
  const couponId = route.params?.couponId;
  const editing = !!couponId;

  const [loaded, setLoaded] = useState(!editing);
  const [existing, setExisting] = useState(null);
  const [allCodes, setAllCodes] = useState([]);

  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiry, setExpiry] = useState('none'); // 'none' | '7' | '30' | '90' | 'keep'
  const [active, setActive] = useState(true);

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const valueRef = useRef(null);
  const minRef = useRef(null);
  const limitRef = useRef(null);

  // Nạp danh sách mã (để sửa, và để kiểm tra trùng mã)
  useEffect(() => {
    let cancelled = false;
    fetchPromotions()
      .then((list) => {
        if (cancelled) return;
        setAllCodes(list);
        const found = list.find((item) => item.id === couponId);
        if (found) {
          setExisting(found);
          setCode(found.code);
          setType(found.type);
          setValue(String(found.value));
          setMinSubtotal(found.minSubtotal ? String(found.minSubtotal) : '');
          setUsageLimit(found.usageLimit !== null ? String(found.usageLimit) : '');
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
  }, [couponId]);

  const submit = useCallback(async () => {
    if (busy) return;

    const next = {};
    const normalized = normalizeCode(code);
    if (!CODE_PATTERN.test(normalized)) {
      next.code = 'Use 3–20 letters, numbers, - or _.';
    } else if (allCodes.some((item) => item.code === normalized && item.id !== couponId)) {
      next.code = 'This code already exists.';
    }

    const amount = toNumber(value);
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      next.value = 'Enter an amount above 0.';
    } else if (type === 'percent' && (amount > 100 || !Number.isInteger(amount))) {
      next.value = 'Use a whole number from 1 to 100.';
    }

    let min = 0;
    if (minSubtotal.trim()) {
      min = toNumber(minSubtotal);
      if (!Number.isFinite(min) || min < 0) next.minSubtotal = 'Enter 0 or more.';
    }

    let limit = null;
    if (usageLimit.trim()) {
      limit = toNumber(usageLimit);
      if (!Number.isInteger(limit) || limit < 1) next.usageLimit = 'Use a whole number, 1 or more.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let expiresAt = null;
    if (expiry === 'keep') expiresAt = existing?.expiresAt || null;
    else if (expiry !== 'none') expiresAt = expiryFromDays(Number(expiry));

    const data = {
      code: normalized,
      type,
      value: amount,
      minSubtotal: min,
      usageLimit: limit,
      expiresAt,
      active,
    };
    const id = editing ? couponId : newId();

    setBusy(true);
    try {
      const saved = await updateCoupons((list) =>
        editing
          ? list.map((item) => (item.id === id ? { ...item, ...data } : item))
          : [...list, { id, ...data, usedCount: 0 }]
      );
      if (!saved.some((item) => item.id === id)) {
        setBusy(false);
        setErrors({ code: 'This code already exists.' });
        return;
      }
      navigation.goBack();
    } catch {
      setBusy(false);
      Alert.alert('Discount code', 'Could not save the code. Please try again.');
    }
  }, [busy, code, type, value, minSubtotal, usageLimit, expiry, active, existing, editing, couponId, allCodes, navigation]);

  const remove = useCallback(() => {
    Alert.alert('Delete this code?', 'Orders that already used it are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await updateCoupons((list) => list.filter((item) => item.id !== couponId));
            navigation.goBack();
          } catch {
            setBusy(false);
            Alert.alert('Discount code', 'Could not delete the code. Please try again.');
          }
        },
      },
    ]);
  }, [couponId, navigation]);

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
        <Text style={styles.notFound}>{failed ? 'Couldn’t load the code' : 'Code not found'}</Text>
      </View>
    );
  }

  const expiryOptions =
    existing?.expiresAt
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
          label="Code"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          error={errors.code}
          placeholder="e.g. WELCOME10"
          autoCapitalize="characters"
          maxLength={20}
          returnKeyType="next"
          onSubmitEditing={() => valueRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.segment}>
          {[
            { key: 'percent', label: 'Percentage (%)' },
            { key: 'fixed', label: 'Fixed amount ($)' },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setType(option.key)}
              style={[styles.segmentItem, type === option.key && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: type === option.key }}
            >
              <Text style={[styles.segmentText, type === option.key && styles.segmentTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <AuthField
          ref={valueRef}
          label={type === 'percent' ? 'Discount (%)' : 'Discount amount ($)'}
          value={value}
          onChangeText={setValue}
          error={errors.value}
          placeholder={type === 'percent' ? '10' : '15'}
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => minRef.current?.focus()}
          blurOnSubmit={false}
        />
        <AuthField
          ref={minRef}
          label="Minimum order ($, optional)"
          value={minSubtotal}
          onChangeText={setMinSubtotal}
          error={errors.minSubtotal}
          placeholder="0"
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => limitRef.current?.focus()}
          blurOnSubmit={false}
        />
        <AuthField
          ref={limitRef}
          label="Usage limit (optional)"
          value={usageLimit}
          onChangeText={setUsageLimit}
          error={errors.usageLimit}
          placeholder="Unlimited"
          keyboardType="number-pad"
          returnKeyType="done"
        />

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
            <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Create code'}</Text>
          )}
        </Pressable>

        {editing && (
          <Pressable onPress={remove} disabled={busy} style={styles.danger} accessibilityRole="button">
            <Ionicons name="trash-outline" size={18} color="#B3261E" />
            <Text style={styles.dangerText}>Delete code</Text>
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
