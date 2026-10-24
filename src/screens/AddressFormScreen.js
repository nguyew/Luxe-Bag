import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import AuthField from '../components/AuthField';
import useAuth from '../hooks/useAuth';
import { validatePhone, validateRequired } from '../utils/validation';

const LABELS = ['Home', 'Office', 'Other'];

const newId = () =>
  `addr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Thêm mới hoặc sửa một địa chỉ (route.params.addressId = sửa). */
export default function AddressFormScreen({ navigation, route }) {
  const { user, saveAddresses } = useAuth();
  const addresses = useMemo(() => user?.addresses || [], [user]);
  const editing = addresses.find((item) => item.id === route.params?.addressId) || null;

  const [label, setLabel] = useState(editing?.label || 'Home');
  const [fullName, setFullName] = useState(editing?.fullName || user?.name || '');
  const [phone, setPhone] = useState(editing?.phone || user?.phone || '');
  const [line1, setLine1] = useState(editing?.line1 || '');
  const [city, setCity] = useState(editing?.city || '');
  const [isDefault, setIsDefault] = useState(editing ? editing.isDefault : addresses.length === 0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const phoneRef = useRef(null);
  const lineRef = useRef(null);
  const cityRef = useRef(null);

  const submit = useCallback(async () => {
    if (busy) return;

    const nextErrors = {};
    const nameError = validateRequired(fullName, 'Enter the receiver’s name.');
    const phoneError = validatePhone(phone);
    const lineError = validateRequired(line1, 'Enter the street address.');
    const cityError = validateRequired(city, 'Enter the city.');
    if (nameError) nextErrors.fullName = nameError;
    if (phoneError) nextErrors.phone = phoneError;
    if (lineError) nextErrors.line1 = lineError;
    if (cityError) nextErrors.city = cityError;
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    const entry = {
      id: editing ? editing.id : newId(),
      label,
      fullName: fullName.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      city: city.trim(),
      isDefault,
    };

    let merged = editing
      ? addresses.map((item) => (item.id === entry.id ? entry : item))
      : [...addresses, entry];

    // Chọn làm mặc định thì bỏ mặc định của các địa chỉ khác
    if (isDefault) {
      merged = merged.map((item) => ({ ...item, isDefault: item.id === entry.id }));
    }

    setBusy(true);
    try {
      await saveAddresses(merged);
      navigation.goBack();
    } catch {
      setFormError('Could not save the address. Please try again.');
      setBusy(false);
    }
  }, [busy, fullName, phone, line1, city, label, isDefault, editing, addresses, saveAddresses, navigation]);

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
        <Text style={styles.sectionLabel}>Label</Text>
        <View style={styles.chips}>
          {LABELS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setLabel(item)}
              style={[styles.chip, label === item && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: label === item }}
            >
              <Text style={[styles.chipText, label === item && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <AuthField
          label="Receiver’s name"
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          placeholder="Full name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
          blurOnSubmit={false}
        />
        <AuthField
          ref={phoneRef}
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          placeholder="0901 234 567"
          keyboardType="phone-pad"
          returnKeyType="next"
          onSubmitEditing={() => lineRef.current?.focus()}
          blurOnSubmit={false}
        />
        <AuthField
          ref={lineRef}
          label="Street address"
          value={line1}
          onChangeText={setLine1}
          error={errors.line1}
          placeholder="House number, street, ward, district"
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="next"
          onSubmitEditing={() => cityRef.current?.focus()}
          blurOnSubmit={false}
        />
        <AuthField
          ref={cityRef}
          label="City / Province"
          value={city}
          onChangeText={setCity}
          error={errors.city}
          placeholder="Ho Chi Minh City"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Set as default address</Text>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            disabled={editing?.isDefault && addresses.length === 1}
            trackColor={{ true: '#050505', false: '#D8D2CC' }}
          />
        </View>

        {!!formError && <Text style={styles.formError}>{formError}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.busy]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Save address'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#55514C',
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: '#050505' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  chipTextOn: { color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 20,
  },
  switchLabel: { fontSize: 14, color: '#1A1A1A' },
  formError: { marginBottom: 12, textAlign: 'center', fontSize: 13, color: '#B3261E' },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.7 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
