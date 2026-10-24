import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddressCard from '../components/AddressCard';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import useHandbags from '../hooks/useHandbags';
import { describeOrderError, placeOrder } from '../services/orderService';
import { PAYMENT_METHODS } from '../utils/orders';
import { formatPrice } from '../utils/format';
import { tapLight } from '../utils/haptics';

const BAR_HEIGHT = 56;

const REASONS = {
  sold_out: 'sold out',
  insufficient: 'not enough in stock',
  unavailable: 'no longer available',
};

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const cart = useCart();
  const { reload } = useHandbags();

  const [addressId, setAddressId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [method, setMethod] = useState('cod');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [problems, setProblems] = useState([]);

  const addresses = user?.addresses || [];
  const address =
    addresses.find((item) => item.id === addressId) ||
    addresses.find((item) => item.isDefault) ||
    addresses[0] ||
    null;

  const submit = useCallback(async () => {
    if (busy || !user) return;
    if (!address) {
      setError(describeOrderError({ code: 'no_address' }));
      return;
    }

    setBusy(true);
    setError('');
    setProblems([]);
    try {
      const order = await placeOrder({
        userId: user.id,
        lines: cart.lines.map((line) => ({ id: line.id, qty: line.qty })),
        address,
        paymentMethod: method,
      });
      tapLight();
      cart.clear();
      reload(); // tồn kho đã đổi -> tải lại danh sách túi
      // busy giữ nguyên để không nháy màn "giỏ trống" trước khi chuyển trang
      navigation.replace('OrderDetail', { orderId: order.id, order, placed: true });
    } catch (e) {
      setError(describeOrderError(e));
      setProblems(e?.code === 'unavailable' ? e.details : []);
      if (e?.code === 'unavailable') reload(); // để giỏ hàng đánh dấu món có vấn đề
      setBusy(false);
    }
  }, [busy, user, address, cart, method, reload, navigation]);

  if (!isLoggedIn) {
    return (
      <View style={styles.screen}>
        <SignInPrompt
          icon="lock-closed-outline"
          title="Sign in to check out"
          message="You need an account to place an order."
        />
      </View>
    );
  }

  if (cart.lines.length === 0 && !busy) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="bag-handle-outline" size={44} color="#77716A" />
        <Text style={styles.emptyTitle}>Your bag is empty</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondary} accessibilityRole="button">
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const blocked = cart.hasProblem || cart.subtotal <= 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: BAR_HEIGHT + insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Địa chỉ giao hàng */}
        <Text style={styles.section}>Delivery address</Text>
        {address ? (
          <AddressCard address={address}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              style={styles.changeLink}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{addresses.length > 1 ? 'Change address' : 'Manage'}</Text>
            </Pressable>
          </AddressCard>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('AddressForm')}
            style={styles.addAddress}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={22} color="#1A1A1A" />
            <Text style={styles.addAddressText}>Add a delivery address</Text>
          </Pressable>
        )}

        {/* Thanh toán */}
        <Text style={styles.section}>Payment</Text>
        {Object.entries(PAYMENT_METHODS).map(([key, info]) => (
          <Pressable
            key={key}
            onPress={() => setMethod(key)}
            style={[styles.method, method === key && styles.methodOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: method === key }}
          >
            <Ionicons name={info.icon} size={22} color="#1A1A1A" />
            <View style={styles.methodText}>
              <Text style={styles.methodLabel}>{info.label}</Text>
              <Text style={styles.methodHint}>{info.hint}</Text>
            </View>
            <Ionicons
              name={method === key ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={method === key ? '#050505' : '#B9B2AA'}
            />
          </Pressable>
        ))}

        {/* Tóm tắt đơn */}
        <Text style={styles.section}>Order summary</Text>
        <View style={styles.summary}>
          {cart.lines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={[styles.lineName, !!line.problem && styles.lineBad]} numberOfLines={2}>
                {line.qty} × {line.product?.handbagName || 'Unavailable item'}
              </Text>
              <Text style={[styles.lineValue, !!line.problem && styles.lineBad]}>
                {formatPrice(line.lineTotal)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.lineValue}>{formatPrice(cart.subtotal)}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.rowLabel}>Shipping</Text>
            <Text style={styles.lineValue}>
              {cart.shipping === 0 ? 'Free' : formatPrice(cart.shipping)}
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(cart.total)}</Text>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={18} color="#B3261E" />
            <View style={styles.errorBody}>
              <Text style={styles.errorText}>{error}</Text>
              {problems.map((item) => (
                <Text key={item.id} style={styles.errorDetail}>
                  • {item.name}: {REASONS[item.reason] || 'unavailable'}
                  {item.reason === 'insufficient' ? ` (${item.available} left)` : ''}
                </Text>
              ))}
            </View>
          </View>
        )}

        {cart.hasProblem && (
          <Pressable onPress={() => navigation.goBack()} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Back to bag to fix items</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Thanh đặt hàng cố định ở đáy */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={submit}
          disabled={busy || blocked}
          style={[styles.place, (busy || blocked) && styles.placeDisabled]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.placeText}>Place order · {formatPrice(cart.total)}</Text>
          )}
        </Pressable>
      </View>

      {/* Chọn địa chỉ khác */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.sheetTitle}>Choose an address</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {addresses.map((item) => (
              <AddressCard
                key={item.id}
                address={item}
                selected={item.id === address?.id}
                onPress={() => {
                  setAddressId(item.id);
                  setPickerOpen(false);
                }}
              />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => {
              setPickerOpen(false);
              navigation.navigate('AddressForm');
            }}
            style={styles.secondary}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Add new address</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  section: {
    marginTop: 8,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  changeLink: { alignSelf: 'flex-start', marginTop: 12 },
  link: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textDecorationLine: 'underline' },
  addAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 18,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  addAddressText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  methodOn: { borderColor: '#050505' },
  methodText: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  methodHint: { marginTop: 2, fontSize: 12, color: '#77716A' },
  summary: { padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF' },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  lineName: { flex: 1, fontSize: 13, lineHeight: 18, color: '#1A1A1A' },
  lineValue: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  lineBad: { color: '#B3261E' },
  rowLabel: { fontSize: 13, color: '#77716A' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, backgroundColor: '#D8D2CC' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#0D0D0D' },
  totalValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: '#0D0D0D' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#FBE3E1',
  },
  errorBody: { flex: 1 },
  errorText: { fontSize: 13, lineHeight: 18, color: '#B3261E' },
  errorDetail: { marginTop: 4, fontSize: 12, color: '#B3261E' },
  secondary: {
    alignSelf: 'center',
    height: 44,
    marginTop: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#F3F1F1',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DFDA',
  },
  place: {
    height: BAR_HEIGHT - 8,
    borderRadius: (BAR_HEIGHT - 8) / 2,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDisabled: { backgroundColor: '#B9B2AA' },
  placeText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '75%',
    padding: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#F3F1F1',
  },
  sheetTitle: { marginBottom: 12, fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  sheetList: { flexGrow: 0 },
});
