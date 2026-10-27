import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CartItem from '../components/CartItem';
import SignInPrompt from '../components/SignInPrompt';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import { FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS } from '../utils/orders';
import { lineSavings } from '../utils/catalog';
import { formatPrice } from '../utils/format';
import { tapSelect } from '../utils/haptics';

const TAB_BAR_SPACE = 110; // chừa chỗ cho tab bar nổi

export default function CartScreen({ navigation }) {
  const { isLoggedIn, user } = useAuth();
  const cart = useCart();
  const { setQty, remove } = cart; // hàm ổn định -> CartItem (memo) không vẽ lại thừa

  const openDetail = useCallback(
    (handbag) => navigation.navigate('Detail', { handbag }),
    [navigation]
  );
  const increase = useCallback(
    (line) => {
      tapSelect();
      setQty(line.id, Math.min(line.qty + 1, line.maxQty));
    },
    [setQty]
  );
  const decrease = useCallback(
    (line) => {
      tapSelect();
      setQty(line.id, Math.max(line.qty - 1, 1));
    },
    [setQty]
  );
  const renderItem = useCallback(
    ({ item }) => (
      <CartItem
        line={item}
        onOpen={openDetail}
        onIncrease={increase}
        onDecrease={decrease}
        onRemove={remove}
      />
    ),
    [openDetail, increase, decrease, remove]
  );

  const confirmClear = () => {
    Alert.alert('Clear your bag?', 'All items will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: cart.clear },
    ]);
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />
        <SignInPrompt
          icon="bag-handle-outline"
          title="Your bag"
          message="Sign in to add handbags to your bag and place orders."
        />
      </SafeAreaView>
    );
  }

  if (!cart.ready) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <ActivityIndicator color="#292725" />
      </SafeAreaView>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />
        <View style={[styles.center, styles.empty]}>
          <Ionicons name="bag-handle-outline" size={46} color="#77716A" />
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptyText}>Browse the collection and add something you love.</Text>
          <Pressable
            onPress={() => navigation.navigate('Home')}
            style={styles.primary}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Start shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const toFreeShipping = FREE_SHIPPING_THRESHOLD - cart.subtotal;

  // Thông tin hiển thị thêm, lấy từ dữ liệu sản phẩm và tài khoản (API)
  const savings = cart.lines
    .filter((line) => !line.problem && line.product)
    .reduce((sum, line) => sum + lineSavings(line.product, line.qty), 0);
  const addresses = user?.addresses || [];
  const shipTo = addresses.find((item) => item.isDefault) || addresses[0] || null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <FlatList
        data={cart.lines}
        keyExtractor={(line) => line.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>My Bag</Text>
              <Text style={styles.count}>
                {cart.count} {cart.count === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <Pressable onPress={confirmClear} hitSlop={10} accessibilityRole="button">
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View style={styles.summary}>
            {cart.hasProblem && (
              <View style={styles.notice}>
                <Ionicons name="alert-circle-outline" size={18} color="#B3261E" />
                <Text style={styles.noticeText}>
                  Some items are unavailable or exceed the stock left.
                </Text>
                <Pressable onPress={cart.fixProblems} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.noticeAction}>Fix bag</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                Subtotal ({cart.count} {cart.count === 1 ? 'item' : 'items'})
              </Text>
              <Text style={styles.rowValue}>{formatPrice(cart.subtotal)}</Text>
            </View>
            {savings > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>You save</Text>
                <Text style={[styles.rowValue, styles.saveValue]}>-{formatPrice(savings)}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Shipping</Text>
              <Text style={[styles.rowValue, cart.shipping === 0 && styles.saveValue]}>
                {cart.shipping === 0 ? 'Free' : formatPrice(cart.shipping)}
              </Text>
            </View>
            {cart.shipping > 0 && toFreeShipping > 0 && (
              <Text style={styles.hint}>
                Add {formatPrice(toFreeShipping)} more for free shipping.
              </Text>
            )}

            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(cart.total)}</Text>
            </View>

            {/* Thông tin giao hàng & chính sách */}
            <View style={styles.infoBlock}>
              {!!shipTo && (
                <View style={styles.infoLine}>
                  <Ionicons name="location-outline" size={16} color="#55514C" />
                  <Text style={styles.infoText} numberOfLines={2}>
                    Deliver to {shipTo.fullName} · {shipTo.city}
                  </Text>
                </View>
              )}
              <View style={styles.infoLine}>
                <Ionicons name="return-down-back-outline" size={16} color="#55514C" />
                <Text style={styles.infoText}>
                  Easy returns within {RETURN_WINDOW_DAYS} days of delivery
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Checkout')}
              disabled={cart.hasProblem || cart.subtotal <= 0}
              style={[
                styles.primary,
                styles.checkout,
                (cart.hasProblem || cart.subtotal <= 0) && styles.disabled,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Checkout</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1, color: '#0D0D0D' },
  count: { marginTop: 2, fontSize: 13, color: '#77716A' },
  clear: { fontSize: 13, fontWeight: '700', color: '#77716A' },

  empty: { flex: 1, paddingHorizontal: 32, paddingBottom: TAB_BAR_SPACE },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '800', color: '#0D0D0D' },
  emptyText: { marginTop: 6, fontSize: 13, textAlign: 'center', color: '#77716A' },

  summary: { marginTop: 8, padding: 18, borderRadius: 26, backgroundColor: '#FFFFFF' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#FBE3E1',
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#B3261E' },
  noticeAction: { fontSize: 13, fontWeight: '800', color: '#B3261E' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLabel: { fontSize: 14, color: '#77716A' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  saveValue: { color: '#1F7A3E' },
  infoBlock: { marginTop: 14, gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#F3F1F1' },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#55514C' },
  hint: { marginBottom: 4, fontSize: 12, color: '#8A5A00' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, backgroundColor: '#D8D2CC' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  totalValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: '#0D0D0D' },

  primary: {
    minWidth: 160,
    height: 50,
    marginTop: 22,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkout: { marginTop: 14, alignSelf: 'stretch' },
  disabled: { backgroundColor: '#B9B2AA' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});