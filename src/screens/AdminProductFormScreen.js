import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AuthField from '../components/AuthField';
import FilterChips from '../components/FilterChips';
import RemoteImage from '../components/RemoteImage';
import { PRODUCT_STATUS } from '../components/ProductStatusBadge';
import useHandbags, { useHandbag } from '../hooks/useHandbags';
import { createHandbag, deleteHandbag, updateHandbag, uploadProductImage } from '../services/adminService';
import { getStock } from '../utils/catalog';
import { formatBrand, formatCategory, knownLabel } from '../utils/format';

const IMAGE_URL = /^https?:\/\/\S+$/i;
const STATUS_KEYS = ['draft', 'published', 'archived'];

const toNumber = (text) => Number(String(text).trim().replace(',', '.'));

// percentOff trong API là số thập phân (0.42) -> ô nhập hiển thị 42
function percentText(value) {
  const n = Number(value);
  if (!n || n <= 0) return '';
  return String(Math.round(n <= 1 ? n * 100 : n));
}

const stockText = (item) => {
  const stock = getStock(item);
  return stock === null ? '' : String(stock);
};

/** Thêm mới / sửa sản phẩm (route.params.handbagId = sửa). */
export default function AdminProductFormScreen({ navigation, route }) {
  const handbagId = route.params?.handbagId;
  const { allItems } = useHandbags();
  const existing = useHandbag(handbagId, undefined);
  const editing = !!handbagId;

  const initialStock = existing ? stockText(existing) : '';

  const [name, setName] = useState(existing?.handbagName || '');
  const [brand, setBrand] = useState(existing?.brand || '');
  const [category, setCategory] = useState(existing?.category || '');
  // Hiện tên dễ đọc thay cho mã ID trong ô nhập; giá trị lưu chỉ đổi khi admin tự gõ hoặc chọn gợi ý
  const [brandTyped, setBrandTyped] = useState(false);
  const [categoryTyped, setCategoryTyped] = useState(false);
  const [cost, setCost] = useState(existing?.cost !== undefined ? String(existing.cost) : '');
  const [discount, setDiscount] = useState(existing ? percentText(existing.percentOff) : '');
  const [colors, setColors] = useState(
    Array.isArray(existing?.color) ? existing.color.join(', ') : existing?.color || ''
  );
  const [gender, setGender] = useState(typeof existing?.gender === 'boolean' ? existing.gender : true);
  const [stock, setStock] = useState(editing ? initialStock : '10');
  const [status, setStatus] = useState(existing?.status || (editing ? 'published' : 'draft'));
  const [uri, setUri] = useState(existing?.uri || '');
  const [imageKey, setImageKey] = useState(existing?.imageKey || '');

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  const nameRef = useRef(null);
  const brandRef = useRef(null);
  const categoryRef = useRef(null);
  const costRef = useRef(null);
  const discountRef = useRef(null);
  const colorRef = useRef(null);
  const stockRef = useRef(null);
  const uriRef = useRef(null);

  // Gợi ý thương hiệu / danh mục đã có
  const brandOptions = useMemo(
    () =>
      [...new Set(allItems.map((item) => item.brand).filter(Boolean))]
        .sort()
        .map((value) => ({ key: value, label: formatBrand(value) })),
    [allItems]
  );
  const categoryOptions = useMemo(
    () =>
      [...new Set(allItems.map((item) => item.category).filter(Boolean))]
        .sort()
        .map((value) => ({ key: value, label: formatCategory(value) })),
    [allItems]
  );

  const validUri = IMAGE_URL.test(uri.trim());

  const chooseImage = useCallback(async () => {
    if (imageBusy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType || 'image/jpeg';
    setImageBusy(true);
    try {
      const uploaded = await uploadProductImage(asset.uri, contentType);
      setUri(uploaded.uri);
      setImageKey(uploaded.imageKey);
    } catch {
      Alert.alert('Image', 'Could not upload the image. Please try again.');
    } finally {
      setImageBusy(false);
    }
  }, [imageBusy]);

  const submit = useCallback(async () => {
    if (busy) return;

    const next = {};
    if (!name.trim()) next.name = 'Enter the product name.';
    if (!brand.trim()) next.brand = 'Enter the brand.';

    const price = toNumber(cost);
    if (!cost.trim() || !Number.isFinite(price) || price <= 0) next.cost = 'Enter a price above 0.';

    let percent = 0;
    if (editing && discount.trim()) {
      percent = toNumber(discount);
      if (!Number.isInteger(percent) || percent < 0 || percent > 90) {
        next.discount = 'Use a whole number from 0 to 90.';
      }
    }

    const stockChanged = stock.trim() !== initialStock;
    const stockValue = toNumber(stock);
    if (!editing || stockChanged) {
      if (!stock.trim() || !Number.isInteger(stockValue) || stockValue < 0) {
        next.stock = 'Use a whole number, 0 or more.';
      }
    }

    if (!validUri) next.uri = 'Enter a valid image link starting with http(s)://';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      handbagName: name.trim(),
      brand: brand.trim(),
      category: category.trim(),
      cost: price,
      color: colors
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      gender,
      uri: uri.trim(),
      imageKey,
      status,
    };
    if (editing) payload.percentOff = percent / 100;
    // Chỉ gửi stock khi admin chủ động sửa: tránh ghi đè số lượng khách vừa mua
    if (!editing || stockChanged) payload.stock = stockValue;

    setBusy(true);
    try {
      if (editing) await updateHandbag(handbagId, payload);
      else await createHandbag(payload);
      navigation.goBack();
    } catch {
      setBusy(false);
      Alert.alert('Product', 'Could not save the product. Please try again.');
    }
  }, [
    busy, name, brand, category, cost, discount, colors, gender, stock, status, uri,
    editing, initialStock, validUri, handbagId, navigation, imageKey,
  ]);

  const archive = useCallback(async () => {
    setBusy(true);
    try {
      await updateHandbag(handbagId, { status: 'archived' });
      navigation.goBack();
    } catch {
      setBusy(false);
      Alert.alert('Product', 'Could not archive the product. Please try again.');
    }
  }, [handbagId, navigation]);

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      await deleteHandbag(handbagId);
      navigation.goBack();
    } catch {
      setBusy(false);
      Alert.alert('Product', 'Could not delete the product. Please try again.');
    }
  }, [handbagId, navigation]);

  const confirmRemove = () => {
    Alert.alert(
      'Remove this product?',
      'Archiving hides it from customers but keeps it. Deleting is permanent: past orders keep their own copy, but favorites and bags will show it as unavailable.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive instead', onPress: archive },
        { text: 'Delete permanently', style: 'destructive', onPress: remove },
      ]
    );
  };

  if (editing && !existing) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={44} color="#77716A" />
        <Text style={styles.notFound}>Product not found</Text>
      </View>
    );
  }

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
        {/* Ảnh */}
        <View style={styles.preview}>
          {validUri ? (
            <RemoteImage uri={uri.trim()} style={styles.previewImage} />
          ) : (
            <Ionicons name="image-outline" size={40} color="#B9B2AA" />
          )}
        </View>
        <Pressable onPress={chooseImage} style={styles.imageButton} disabled={imageBusy}>
          {imageBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.imageButtonText}>Choose and upload image</Text>}
        </Pressable>
        <AuthField
          ref={uriRef}
          label="Image link"
          value={uri}
          onChangeText={setUri}
          error={errors.uri}
          placeholder="https://…"
          keyboardType="url"
          returnKeyType="next"
          onSubmitEditing={() => nameRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={nameRef}
          label="Product name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Serpenti Forever Crossbody"
          autoCapitalize="words"
          autoCorrect
          returnKeyType="next"
          onSubmitEditing={() => brandRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={brandRef}
          label="Brand"
          value={!brandTyped && knownLabel(brand) ? knownLabel(brand) : brand}
          onChangeText={(text) => {
            setBrandTyped(true);
            setBrand(text);
          }}
          error={errors.brand}
          placeholder="e.g. Fendi"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => categoryRef.current?.focus()}
          blurOnSubmit={false}
        />
        {brandOptions.length > 0 && (
          <View style={styles.suggest}>
            <FilterChips
              options={brandOptions}
              value={brand}
              onChange={(value) => {
                setBrandTyped(false);
                setBrand(value);
              }}
            />
          </View>
        )}

        <AuthField
          ref={categoryRef}
          label="Category"
          value={!categoryTyped && knownLabel(category) ? knownLabel(category) : category}
          onChangeText={(text) => {
            setCategoryTyped(true);
            setCategory(text);
          }}
          placeholder="e.g. Shoulder Bag"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => costRef.current?.focus()}
          blurOnSubmit={false}
        />
        {categoryOptions.length > 0 && (
          <View style={styles.suggest}>
            <FilterChips
              options={categoryOptions}
              value={category}
              onChange={(value) => {
                setCategoryTyped(false);
                setCategory(value);
              }}
            />
          </View>
        )}

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <AuthField
              ref={costRef}
              label="Price (₫)"
              value={cost}
              onChangeText={setCost}
              error={errors.cost}
              placeholder="0"
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => (editing ? discountRef.current?.focus() : stockRef.current?.focus())}
              blurOnSubmit={false}
            />
          </View>
          {editing && (
            <View style={styles.col}>
              <AuthField
                ref={discountRef}
                label="Discount (%)"
                value={discount}
                onChangeText={setDiscount}
                error={errors.discount}
                placeholder="0"
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                onSubmitEditing={() => stockRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          )}
        </View>

        <AuthField
          ref={stockRef}
          label="Stock"
          value={stock}
          onChangeText={setStock}
          error={errors.stock}
          placeholder={editing ? 'Not tracked' : '10'}
          keyboardType="number-pad"
          returnKeyType="next"
          onSubmitEditing={() => colorRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={colorRef}
          label="Colors (comma separated)"
          value={colors}
          onChangeText={setColors}
          placeholder="Red, Black"
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.segment}>
          {[
            { key: true, label: 'Women', icon: 'female' },
            { key: false, label: 'Men', icon: 'male' },
          ].map((option) => (
            <Pressable
              key={String(option.key)}
              onPress={() => setGender(option.key)}
              style={[styles.segmentItem, gender === option.key && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: gender === option.key }}
            >
              <Ionicons
                name={option.icon}
                size={16}
                color={gender === option.key ? '#FFFFFF' : '#1A1A1A'}
              />
              <Text style={[styles.segmentText, gender === option.key && styles.segmentTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.segment}>
          {STATUS_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setStatus(key)}
              style={[styles.segmentItem, status === key && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: status === key }}
            >
              <Text style={[styles.segmentText, status === key && styles.segmentTextOn]}>
                {PRODUCT_STATUS[key].label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          {status === 'published'
            ? 'Visible to customers.'
            : status === 'draft'
            ? 'Draft: hidden from customers until you publish it.'
            : 'Archived: hidden from customers but kept in your list.'}
        </Text>

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.busy]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Create product'}</Text>
          )}
        </Pressable>

        {editing && (
          <Pressable
            onPress={confirmRemove}
            disabled={busy}
            style={styles.danger}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color="#B3261E" />
            <Text style={styles.dangerText}>Archive or delete</Text>
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
  preview: {
    alignSelf: 'center',
    width: 132,
    height: 164,
    marginBottom: 18,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
  imageButton: {
    alignSelf: 'center',
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  imageButtonText: { color: '#FFFFFF', fontWeight: '700' },
  suggest: { marginHorizontal: -20, marginTop: -6, marginBottom: 6 },
  twoCols: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  label: {
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#55514C',
  },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
  },
  segmentOn: { backgroundColor: '#050505' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  segmentTextOn: { color: '#FFFFFF' },
  hint: { marginLeft: 6, marginBottom: 20, fontSize: 12, color: '#77716A' },
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