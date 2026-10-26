import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FilterChips from './FilterChips';
import { applyBulkDiscount } from '../services/adminService';

/**
 * Giảm giá hàng loạt theo tên sản phẩm, thương hiệu hoặc danh mục.
 * Nhập 0 để xóa giảm giá. (percentOff lưu dạng thập phân: 20% -> 0.2)
 */
export default function BulkDiscountSheet({ visible, items, onClose, onApplied }) {
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState('all');
  const [discountMode, setDiscountMode] = useState('fake');
  const [percentText, setPercentText] = useState('');
  const [busy, setBusy] = useState(false);

  const names = useMemo(
    () => [...new Set(items.map((item) => item.handbagName).filter(Boolean))].sort(),
    [items]
  );
  const brands = useMemo(
    () => [...new Set(items.map((item) => item.brand).filter(Boolean))].sort(),
    [items]
  );
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    [items]
  );
  const options = useMemo(
    () => [
      { key: 'all', label: 'All products' },
      ...names.map((name) => ({ key: `name:${name}`, label: `Name: ${name}` })),
      ...brands.map((brand) => ({ key: `brand:${brand}`, label: `Brand: ${brand}` })),
      ...categories.map((category) => ({ key: `category:${category}`, label: `Category: ${category}` })),
    ],
    [brands, categories, names]
  );

  const [scope, targetValue] = target === 'all' ? ['all', ''] : target.split(':');
  const affected = useMemo(
    () => items.filter((item) => scope === 'all' || item[scope === 'name' ? 'handbagName' : scope] === targetValue),
    [items, scope, targetValue]
  );

  const percent = Number(percentText);
  const valid = percentText.trim() !== '' && Number.isInteger(percent) && percent >= 0 && percent <= 90;

  const apply = () => {
    if (!valid || busy || affected.length === 0) return;

    const what = percent === 0 ? 'Clear the discount from' : `${discountMode === 'real' ? 'Reduce the price and show' : 'Show'} a “${percent}% off” discount on`;
    Alert.alert(
      'Apply discount?',
      `${what} ${affected.length} ${affected.length === 1 ? 'product' : 'products'}${
        target === 'all' ? '' : ` (${target})`
      }.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await applyBulkDiscount({
                scope,
                value: targetValue,
                percentOff: percent / 100,
                discountMode,
              });
              Alert.alert('Done', `Updated ${result.updated} products.`);
              setPercentText('');
              onApplied?.();
              onClose();
            } catch (error) {
              Alert.alert('Could not apply discount', error.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>Bulk “% off” label</Text>
          <Text style={styles.sub}>
            Display-only discounts show a higher original price. Reduce-price discounts also change the selling price.
          </Text>

          <Text style={styles.label}>Apply to</Text>
          <View style={styles.chipsWrap}>
            <FilterChips options={options} value={target} onChange={setTarget} />
          </View>

          <Text style={styles.label}>Discount (%)</Text>
          <View style={styles.inputBox}>
            <TextInput
              value={percentText}
              onChangeText={(text) => setPercentText(text.replace(/[^0-9]/g, ''))}
              placeholder="0 – 90"
              placeholderTextColor="#9A948D"
              keyboardType="number-pad"
              maxLength={2}
              style={styles.input}
              accessibilityLabel="Discount percent"
            />
          </View>
          <Text style={styles.count}>
            {affected.length} {affected.length === 1 ? 'product' : 'products'} will be updated
          </Text>

          <Text style={styles.label}>Discount type</Text>
          <FilterChips
            options={[
              { key: 'fake', label: 'Display only' },
              { key: 'real', label: 'Reduce price' },
            ]}
            value={discountMode}
            onChange={setDiscountMode}
          />

          <Pressable
            onPress={apply}
            disabled={!valid || busy || affected.length === 0}
            style={[styles.primary, (!valid || busy || affected.length === 0) && styles.disabled]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Apply discount</Text>}
          </Pressable>
          <Pressable onPress={onClose} disabled={busy} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    paddingTop: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#F3F1F1',
  },
  title: { paddingHorizontal: 20, fontSize: 20, fontWeight: '800', color: '#0D0D0D' },
  sub: { paddingHorizontal: 20, marginTop: 4, fontSize: 13, color: '#77716A' },
  label: {
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#55514C',
  },
  chipsWrap: { marginBottom: -4 },
  inputBox: {
    height: 50,
    marginHorizontal: 20,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  input: { padding: 0, fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  count: { paddingHorizontal: 24, marginTop: 10, fontSize: 12, color: '#77716A' },
  primary: {
    height: 52,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: '#B9B2AA' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cancel: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 20 },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#55514C' },
});
