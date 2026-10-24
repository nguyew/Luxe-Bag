import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RemoteImage from './RemoteImage';
import { formatPrice } from '../utils/format';

/**
 * Một dòng trong giỏ hàng.
 * line: { id, qty, product, unitPrice, lineTotal, maxQty, problem }
 */
function CartItem({ line, onOpen, onIncrease, onDecrease, onRemove }) {
  const { product, qty, maxQty, problem } = line;
  const name = product?.handbagName || 'Item no longer available';
  const unavailable = problem === 'unavailable';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => product && onOpen(product)}
        disabled={!product}
        style={styles.imageWrap}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
      >
        <RemoteImage uri={product?.uri} style={[styles.image, unavailable && styles.dim]} />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            {!!product?.brand && (
              <Text style={styles.brand} numberOfLines={1}>
                {product.brand}
              </Text>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
          </View>

          <Pressable
            onPress={() => onRemove(line.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name} from bag`}
          >
            <Ionicons name="trash-outline" size={20} color="#77716A" />
          </Pressable>
        </View>

        {problem === 'unavailable' && (
          <Text style={styles.problem}>Out of stock or no longer sold</Text>
        )}
        {problem === 'limited' && (
          <Text style={styles.problem}>Only {maxQty} left – please lower the quantity</Text>
        )}

        <View style={styles.bottomRow}>
          {!unavailable ? (
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onDecrease(line)}
                disabled={qty <= 1}
                hitSlop={6}
                style={[styles.stepButton, qty <= 1 && styles.stepDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color="#1A1A1A" />
              </Pressable>
              <Text style={styles.qty} accessibilityLabel={`Quantity ${qty}`}>
                {qty}
              </Text>
              <Pressable
                onPress={() => onIncrease(line)}
                disabled={qty >= maxQty}
                hitSlop={6}
                style={[styles.stepButton, qty >= maxQty && styles.stepDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={16} color="#1A1A1A" />
              </Pressable>
            </View>
          ) : (
            <View />
          )}

          <Text style={[styles.price, unavailable && styles.priceDim]}>
            {formatPrice(line.lineTotal)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(CartItem);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  imageWrap: {
    width: 84,
    height: 104,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  image: { width: '100%', height: '100%' },
  dim: { opacity: 0.35 },
  body: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', gap: 8 },
  titleWrap: { flex: 1 },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  name: { marginTop: 2, fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#1A1A1A' },
  problem: { marginTop: 4, fontSize: 12, fontWeight: '600', color: '#B3261E' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 3,
    borderRadius: 18,
    backgroundColor: '#F3F1F1',
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  qty: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  price: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: '#0D0D0D' },
  priceDim: { color: '#B9B2AA', textDecorationLine: 'line-through' },
});
