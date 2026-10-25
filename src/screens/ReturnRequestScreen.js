import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import { describeOrderError, requestReturn } from '../services/orderService';
import { RETURN_REASONS, RETURN_WINDOW_DAYS, returnDeadline } from '../utils/orders';

/** Khách gửi yêu cầu trả hàng cho một đơn đã giao. */
export default function ReturnRequestScreen({ navigation, route }) {
  const { order } = route.params;
  const { user } = useAuth();

  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const deadline = returnDeadline(order);

  const submit = useCallback(async () => {
    if (busy || !user) return;
    if (!reason) {
      setError('Please choose a reason for the return.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await requestReturn(user.id, order.id, { reason, note });
      Alert.alert(
        'Request sent',
        'The store will review your return request. You can follow its status in your order.'
      );
      navigation.goBack();
    } catch (e) {
      setError(describeOrderError(e));
      setBusy(false);
    }
  }, [busy, user, order.id, reason, note, navigation]);

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
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={18} color="#8A5A00" />
          <Text style={styles.infoText}>
            Returns are accepted within {RETURN_WINDOW_DAYS} days of delivery
            {deadline ? ` (until ${new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}.
            If approved, the whole order {order.id} is refunded.
          </Text>
        </View>

        <Text style={styles.section}>Why are you returning it?</Text>
        {RETURN_REASONS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setReason(item)}
            style={[styles.reason, reason === item && styles.reasonOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === item }}
          >
            <Text style={styles.reasonText}>{item}</Text>
            <Ionicons
              name={reason === item ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={reason === item ? '#050505' : '#B9B2AA'}
            />
          </Pressable>
        ))}

        <Text style={styles.section}>Anything else we should know? (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Describe the problem"
          placeholderTextColor="#9A948D"
          style={styles.input}
          multiline
          maxLength={300}
          accessibilityLabel="Additional details"
        />

        {!!error && (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={16} color="#B3261E" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.busy]}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Send request</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  content: { padding: 20, paddingBottom: 48 },
  info: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFF1D6',
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#8A5A00' },
  section: {
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#55514C',
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonOn: { borderColor: '#050505' },
  reasonText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  input: {
    minHeight: 100,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1A1A1A',
    textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#FBE3E1',
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#B3261E' },
  primary: {
    height: 52,
    marginTop: 22,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.7 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
