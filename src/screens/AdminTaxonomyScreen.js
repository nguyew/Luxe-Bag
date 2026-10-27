import React, { useCallback, useMemo, useState } from 'react';
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
import TextPromptModal from '../components/TextPromptModal';
import useHandbags from '../hooks/useHandbags';
import { bulkUpdateHandbags } from '../services/adminService';
import { facetOptions } from '../utils/filters';
import { formatBrand, formatCategory } from '../utils/format';

const FIELD_LABEL = { brand: 'brand', category: 'category' };

// Tên dễ đọc của một giá trị (mã ID -> tên), chỉ để hiển thị
const labelFor = (field, value) => (field === 'brand' ? formatBrand(value) : formatCategory(value));

/** Quản lý thương hiệu & danh mục: đổi tên hàng loạt (hoặc gộp vào mục đã có). */
export default function AdminTaxonomyScreen() {
  const { allItems, loading } = useHandbags();
  const [target, setTarget] = useState(null); // { field, value } đang đổi tên
  const [busy, setBusy] = useState(false);

  const brands = useMemo(() => facetOptions(allItems, 'brand'), [allItems]);
  const categories = useMemo(() => facetOptions(allItems, 'category'), [allItems]);

  const rename = useCallback(
    async (field, from, to) => {
      const ids = allItems.filter((item) => item[field] === from).map((item) => item.id);
      setBusy(true);
      const result = await bulkUpdateHandbags(ids, { [field]: to });
      setBusy(false);

      Alert.alert(
        'Done',
        result.failed.length === 0
          ? `Updated ${result.updated} ${result.updated === 1 ? 'product' : 'products'}.`
          : `Updated ${result.updated} products. ${result.failed.length} failed – run it again to finish.`
      );
    },
    [allItems]
  );

  const submit = useCallback(
    (to) => {
      const { field, value } = target;
      setTarget(null);
      if (!to || to === value) return;

      const exists = (field === 'brand' ? brands : categories).some((item) => item.value === to);
      if (exists) {
        Alert.alert(
          `Merge into “${to}”?`,
          `All products in “${labelFor(field, value)}” will move to the existing ${FIELD_LABEL[field]} “${to}”.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Merge', onPress: () => rename(field, value, to) },
          ]
        );
      } else {
        rename(field, value, to);
      }
    },
    [target, brands, categories, rename]
  );

  const renderGroup = (title, field, options) => (
    <>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.card}>
        {options.length === 0 ? (
          <Text style={styles.muted}>Nothing here yet.</Text>
        ) : (
          options.map((option, index) => (
            <Pressable
              key={option.value}
              onPress={() => setTarget({ field, value: option.value })}
              disabled={busy}
              style={[styles.row, index < options.length - 1 && styles.rowDivider]}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${labelFor(field, option.value)}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{labelFor(field, option.value)}</Text>
                <Text style={styles.count}>
                  {option.count} {option.count === 1 ? 'product' : 'products'}
                </Text>
              </View>
              <Ionicons name="create-outline" size={20} color="#77716A" />
            </Pressable>
          ))
        )}
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#292725" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Tap a name to rename it. Every product using it is updated. Renaming to a name that already
          exists merges them.
        </Text>
        {renderGroup('Brands', 'brand', brands)}
        {renderGroup('Categories', 'category', categories)}
      </ScrollView>

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.overlayText}>Updating products…</Text>
        </View>
      )}

      <TextPromptModal
        visible={!!target}
        title={target ? `Rename ${FIELD_LABEL[target.field]}` : ''}
        message={target ? `Current name: ${labelFor(target.field, target.value)}` : ''}
        placeholder="New name"
        initialValue={target ? labelFor(target.field, target.value) : ''}
        confirmLabel="Rename"
        required
        maxLength={40}
        onSubmit={submit}
        onCancel={() => setTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  intro: { marginHorizontal: 4, fontSize: 13, lineHeight: 19, color: '#77716A' },
  section: {
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  card: { paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#FFFFFF' },
  muted: { paddingVertical: 18, fontSize: 13, color: '#77716A', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4DFDA' },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  count: { marginTop: 2, fontSize: 12, color: '#77716A' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});