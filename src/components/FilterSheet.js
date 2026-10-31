import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  applyFilters,
  facetOptions,
} from '../utils/filters';
import { formatBrand, formatCategory } from '../utils/format';

function Chip({ label, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const toggle = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * Bảng lọc & sắp xếp nâng cao: sắp xếp, giới tính, danh mục, thương hiệu,
 * khoảng giá, chỉ còn hàng. Nút dưới cùng cho biết trước sẽ có bao nhiêu kết quả.
 * items: danh sách đã lọc theo từ khóa (để đếm kết quả và liệt kê danh mục/brand đang có).
 */
export default function FilterSheet({ visible, items, filters, onApply, onClose }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);

  // Mỗi lần mở thì bắt đầu từ bộ lọc đang áp dụng
  useEffect(() => {
    if (visible) setDraft({ ...DEFAULT_FILTERS, ...filters });
  }, [visible, filters]);

  const categories = useMemo(() => facetOptions(items, 'category'), [items]);
  const brands = useMemo(() => facetOptions(items, 'brand'), [items]);
  const resultCount = useMemo(() => applyFilters(items, draft).length, [items, draft]);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const cleanPrice = (text) => text.replace(/[^0-9]/g, '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter & sort</Text>
            <Pressable
              onPress={() => setDraft({ ...DEFAULT_FILTERS })}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.reset}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.section}>Sort by</Text>
            <View style={styles.wrap}>
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  on={draft.sort === option.key}
                  onPress={() => set({ sort: option.key })}
                />
              ))}
            </View>

            <Text style={styles.section}>Gender</Text>
            <View style={styles.wrap}>
              {[
                { key: 'any', label: 'All' },
                { key: 'women', label: 'Women' },
                { key: 'men', label: 'Men' },
              ].map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  on={draft.gender === option.key}
                  onPress={() => set({ gender: option.key })}
                />
              ))}
            </View>

            {categories.length > 0 && (
              <>
                <Text style={styles.section}>Category</Text>
                <View style={styles.wrap}>
                  {categories.map((option) => (
                    <Chip
                      key={option.value}
                      label={`${formatCategory(option.value)} (${option.count})`}
                      on={draft.categories.includes(option.value)}
                      onPress={() => set({ categories: toggle(draft.categories, option.value) })}
                    />
                  ))}
                </View>
              </>
            )}

            {brands.length > 0 && (
              <>
                <Text style={styles.section}>Brand</Text>
                <View style={styles.wrap}>
                  {brands.map((option) => (
                    <Chip
                      key={option.value}
                      label={`${formatBrand(option.value)} (${option.count})`}
                      on={draft.brands.includes(option.value)}
                      onPress={() => set({ brands: toggle(draft.brands, option.value) })}
                    />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.section}>Price range (₫)</Text>
            <View style={styles.priceRow}>
              <TextInput
                value={draft.minPrice}
                onChangeText={(text) => set({ minPrice: cleanPrice(text) })}
                placeholder="Min"
                placeholderTextColor="#9A948D"
                keyboardType="number-pad"
                style={styles.priceInput}
                accessibilityLabel="Minimum price"
              />
              <Text style={styles.dash}>–</Text>
              <TextInput
                value={draft.maxPrice}
                onChangeText={(text) => set({ maxPrice: cleanPrice(text) })}
                placeholder="Max"
                placeholderTextColor="#9A948D"
                keyboardType="number-pad"
                style={styles.priceInput}
                accessibilityLabel="Maximum price"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>In stock only</Text>
              <Switch
                value={draft.inStockOnly}
                onValueChange={(value) => set({ inStockOnly: value })}
                trackColor={{ true: '#050505', false: '#D8D2CC' }}
              />
            </View>
          </ScrollView>

          <Pressable
            onPress={() => onApply(draft)}
            style={styles.apply}
            accessibilityRole="button"
          >
            <Text style={styles.applyText}>
              Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    paddingTop: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#F3F1F1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0D0D0D' },
  reset: { fontSize: 14, fontWeight: '700', color: '#77716A' },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 8 },
  section: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: '#050505' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  chipTextOn: { color: '#FFFFFF' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1A1A1A',
  },
  dash: { fontSize: 16, color: '#77716A' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 4,
  },
  switchLabel: { fontSize: 15, color: '#1A1A1A' },
  apply: {
    height: 52,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});