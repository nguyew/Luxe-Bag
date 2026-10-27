import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddressCard from '../components/AddressCard';
import RemoteImage from '../components/RemoteImage';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import useHandbags from '../hooks/useHandbags';
import { describeOrderError, placeOrder } from '../services/orderService';
import { fetchPromotions } from '../services/promotionService';
import {
  calcCouponDiscount,
  describeCoupon,
  describeCouponError,
  validateCoupon,
} from '../utils/coupons';
import { PAYMENT_METHODS, RETURN_WINDOW_DAYS, calcTotals, paymentLabel } from '../utils/orders';
import { lineSavings } from '../utils/catalog';
import { formatBrand, formatColors, formatPrice } from '../utils/format';
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

  // Mã giảm giá
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState(null); // { coupon }
  const [couponError, setCouponError] = useState('');
  const [checking, setChecking] = useState(false);
  const [coupons, setCoupons] = useState([]); // mã đang dùng được, lấy từ API

  // Tải danh sách mã giảm giá khả dụng từ Backend để gợi ý cho khách.
  // Lỗi mạng thì bỏ qua: khách vẫn nhập mã bằng tay như trước.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;
    fetchPromotions()
      .then((list) => {
        if (!cancelled) setCoupons(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

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
        couponCode: applied ? applied.coupon.code : undefined,
      });
      tapLight();
      cart.clear();
      reload(); // tồn kho đã đổi -> tải lại danh sách túi
      // busy giữ nguyên để không nháy màn "giỏ trống" trước khi chuyển trang
      navigation.replace('OrderDetail', { orderId: order.id, order, placed: true });
    } catch (e) {
      setError(describeOrderError(e));
      setProblems(e?.code === 'unavailable' ? e.details : []);
      if (e?.code === 'invalid_coupon') {
        setApplied(null); // mã không còn dùng được: bỏ khỏi đơn để khách xem lại tổng tiền
        setCouponError(e.message);
      }
      if (e?.code === 'unavailable') reload(); // để giỏ hàng đánh dấu món có vấn đề
      setBusy(false);
    }
  }, [busy, user, address, cart, method, applied, reload, navigation]);

  const applyCoupon = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setCouponError('');
    try {
      const result = validateCoupon(await fetchPromotions(), couponInput, cart.subtotal);
      if (result.ok) {
        setApplied({ coupon: result.coupon });
        setCouponInput('');
      } else {
        setCouponError(describeCouponError(result));
      }
    } catch {
      setCouponError('Could not check the code. Check your connection and try again.');
    } finally {
      setChecking(false);
    }
  }, [checking, couponInput, cart.subtotal]);

  const applySuggested = useCallback(
    (code) => {
      const result = validateCoupon(coupons, code, cart.subtotal);
      if (result.ok) {
        setApplied({ coupon: result.coupon });
        setCouponError('');
      } else {
        setCouponError(describeCouponError(result));
      }
    },
    [coupons, cart.subtotal]
  );

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

  // Tổng tiền hiển thị: đã trừ mã giảm giá (tính lại theo giỏ hiện tại)
  const discount = applied ? calcCouponDiscount(applied.coupon, cart.subtotal) : 0;
  const totals = calcTotals(
    cart.lines
      .filter((line) => !line.problem)
      .map((line) => ({ unitPrice: line.unitPrice, qty: line.qty })),
    discount
  );

  // Thông tin hiển thị thêm (từ dữ liệu sản phẩm & tài khoản trả về bởi API)
  const goodLines = cart.lines.filter((line) => !line.problem);
  const savings = goodLines.reduce(
    (sum, line) => sum + (line.product ? lineSavings(line.product, line.qty) : 0),
    0
  );
  const contactPhone = user?.phone || address?.phone || '';
  const suggestions = coupons.filter((coupon) => !applied || coupon.code !== applied.coupon.code);

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

        {/* Liên hệ: thông tin tài khoản */}
        {(!!user?.name || !!user?.email || !!contactPhone) && (
          <>
            <Text style={styles.section}>Contact</Text>
            <View style={styles.contactCard}>
              {!!user?.name && (
                <View style={styles.contactRow}>
                  <Ionicons name="person-outline" size={17} color="#55514C" />
                  <Text style={styles.contactText}>{user.name}</Text>
                </View>
              )}
              {!!user?.email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={17} color="#55514C" />
                  <Text style={styles.contactText}>{user.email}</Text>
                </View>
              )}
              {!!contactPhone && (
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={17} color="#55514C" />
                  <Text style={styles.contactText}>{contactPhone}</Text>
                </View>
              )}
            </View>
          </>
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

        {/* Mã giảm giá */}
        <Text style={styles.section}>Discount code</Text>
        {applied ? (
          <View style={styles.couponApplied}>
            <Ionicons name="pricetag" size={18} color="#1F7A3E" />
            <View style={styles.couponText}>
              <Text style={styles.couponCode}>{applied.coupon.code}</Text>
              <Text style={styles.couponDesc}>{describeCoupon(applied.coupon)}</Text>
            </View>
            <Pressable
              onPress={() => setApplied(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove discount code"
            >
              <Text style={styles.couponRemove}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.couponRow}>
            <TextInput
              value={couponInput}
              onChangeText={(text) => {
                setCouponInput(text);
                setCouponError('');
              }}
              placeholder="Enter code"
              placeholderTextColor="#9A948D"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.couponInput}
              returnKeyType="done"
              onSubmitEditing={applyCoupon}
              accessibilityLabel="Discount code"
            />
            <Pressable
              onPress={applyCoupon}
              disabled={checking || couponInput.trim().length === 0}
              style={[
                styles.couponButton,
                (checking || couponInput.trim().length === 0) && styles.couponButtonOff,
              ]}
              accessibilityRole="button"
            >
              {checking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.couponButtonText}>Apply</Text>
              )}
            </Pressable>
          </View>
        )}
        {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
        {suggestions.length > 0 && (
          <View style={styles.suggestWrap}>
            <Text style={styles.suggestLabel}>Available codes</Text>
            {suggestions.slice(0, 3).map((coupon) => (
              <Pressable
                key={coupon.id}
                onPress={() => applySuggested(coupon.code)}
                style={styles.suggestRow}
                accessibilityRole="button"
                accessibilityLabel={`Apply code ${coupon.code}`}
              >
                <Ionicons name="pricetag-outline" size={16} color="#1A1A1A" />
                <View style={styles.suggestText}>
                  <Text style={styles.suggestCode}>{coupon.code}</Text>
                  <Text style={styles.suggestDesc}>{describeCoupon(coupon)}</Text>
                </View>
                <Text style={styles.suggestApply}>Apply</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Tóm tắt đơn */}
        <Text style={styles.section}>
          Order summary · {cart.count} {cart.count === 1 ? 'item' : 'items'}
        </Text>
        <View style={styles.summary}>
          {cart.lines.map((line) => {
            const product = line.product;
            const meta = formatColors(product?.color);
            const originalTotal =
              Number(product?.originalCost) > Number(product?.cost)
                ? Number(product.originalCost) * line.qty
                : 0;
            return (
              <View key={line.id} style={styles.itemRow}>
                <View style={styles.itemThumb}>
                  <RemoteImage uri={product?.uri} style={StyleSheet.absoluteFill} iconSize={20} />
                </View>
                <View style={styles.itemBody}>
                  {!!product?.brand && (
                    <Text style={styles.itemBrand} numberOfLines={1}>
                      {formatBrand(product.brand)}
                    </Text>
                  )}
                  <Text style={[styles.itemName, !!line.problem && styles.lineBad]} numberOfLines={2}>
                    {product?.handbagName || 'Unavailable item'}
                  </Text>
                  {!!meta && <Text style={styles.itemMeta}>{meta}</Text>}
                  <Text style={styles.itemMeta}>
                    {line.qty} × {formatPrice(line.unitPrice)}
                  </Text>
                </View>
                <View style={styles.itemPriceCol}>
                  {!!originalTotal && (
                    <Text style={styles.itemOriginal}>{formatPrice(originalTotal)}</Text>
                  )}
                  <Text style={[styles.lineValue, !!line.problem && styles.lineBad]}>
                    {formatPrice(line.lineTotal)}
                  </Text>
                </View>
              </View>
            );
          })}

          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.lineValue}>{formatPrice(totals.subtotal)}</Text>
          </View>
          {savings > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.rowLabel}>Product savings</Text>
              <Text style={[styles.lineValue, styles.discountText]}>-{formatPrice(savings)}</Text>
            </View>
          )}
          {totals.discount > 0 && (
            <View style={styles.lineRow}>
              <Text style={styles.rowLabel}>Discount ({applied.coupon.code})</Text>
              <Text style={[styles.lineValue, styles.discountText]}>-{formatPrice(totals.discount)}</Text>
            </View>
          )}
          <View style={styles.lineRow}>
            <Text style={styles.rowLabel}>Shipping</Text>
            <Text style={[styles.lineValue, totals.shipping === 0 && styles.discountText]}>
              {totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(totals.total)}</Text>
          </View>

          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <Text style={styles.rowLabel}>Payment</Text>
            <Text style={styles.lineValue}>{paymentLabel(method)}</Text>
          </View>
          {!!address && (
            <View style={styles.lineRow}>
              <Text style={styles.rowLabel}>Ship to</Text>
              <Text style={[styles.lineValue, styles.shipToValue]} numberOfLines={2}>
                {address.fullName} · {address.city}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.policyRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#55514C" />
          <Text style={styles.policyText}>
            Easy returns within {RETURN_WINDOW_DAYS} days of delivery. You can track this order
            from your account after placing it.
          </Text>
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
            <Text style={styles.placeText}>Place order · {formatPrice(totals.total)}</Text>
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
  discountText: { color: '#1F7A3E' },
  contactCard: { padding: 16, gap: 10, marginBottom: 12, borderRadius: 22, backgroundColor: '#FFFFFF' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  suggestWrap: { marginTop: 12, gap: 8 },
  suggestLabel: { marginLeft: 4, fontSize: 12, fontWeight: '700', color: '#77716A' },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  suggestText: { flex: 1 },
  suggestCode: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: '#1A1A1A' },
  suggestDesc: { marginTop: 1, fontSize: 12, color: '#77716A' },
  suggestApply: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textDecorationLine: 'underline' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  itemThumb: {
    width: 54,
    height: 66,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemBrand: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  itemName: { marginTop: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#1A1A1A' },
  itemMeta: { marginTop: 2, fontSize: 12, color: '#8A837B' },
  itemPriceCol: { alignItems: 'flex-end' },
  itemOriginal: { fontSize: 11, color: '#8A837B', textDecorationLine: 'line-through' },
  shipToValue: { flex: 1, textAlign: 'right' },
  policyRow: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 6 },
  policyText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#77716A' },
  couponRow: { flexDirection: 'row', gap: 10 },
  couponInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#1A1A1A',
  },
  couponButton: {
    width: 88,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponButtonOff: { backgroundColor: '#B9B2AA' },
  couponButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  couponError: { marginTop: 8, marginLeft: 8, fontSize: 12, color: '#B3261E' },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#DFF3E5',
  },
  couponText: { flex: 1 },
  couponCode: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: '#1F7A3E' },
  couponDesc: { marginTop: 1, fontSize: 12, color: '#1F7A3E' },
  couponRemove: { fontSize: 13, fontWeight: '700', color: '#1F7A3E', textDecorationLine: 'underline' },
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