import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RemoteImage from './RemoteImage';
import { formatOriginalPrice, formatPercentOff, formatPrice } from '../utils/format';

/**
 * Một dòng trong danh sách yêu thích: ảnh nhỏ, brand, tên, giá, % giảm
 * và nút xóa.
 *
 * Props:
 *  - item:     object handbag
 *  - onOpen:   gọi khi bấm vào dòng (mở Detail), nhận lại item
 *  - onRemove: gọi khi bấm nút xóa, nhận lại item
 */
function FavoriteItem({ item, onOpen, onRemove }) {
  const discount = formatPercentOff(item.percentOff);

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${item.handbagName}, open details`}
    >
      <View style={styles.thumb}>
        <RemoteImage uri={item.uri} style={StyleSheet.absoluteFill} iconSize={30} />

        {typeof item.gender === 'boolean' && (
          <View
            style={[
              styles.genderBadge,
              item.gender ? styles.genderFemale : styles.genderMale,
            ]}
          >
            <Ionicons
              name={item.gender ? 'female' : 'male'}
              size={13}
              color="#FFFFFF"
            />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.textBlock}>
          {!!item.brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {item.brand}
            </Text>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {item.handbagName}
          </Text>
        </View>

        <View style={styles.priceRow}>
          {!!formatOriginalPrice(item) && (
            <Text style={styles.originalPrice}>{formatOriginalPrice(item)}</Text>
          )}
          <Text style={styles.price}>{formatPrice(item.cost)}</Text>
          {!!discount && (
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>{discount} off</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => onRemove(item)}
        style={styles.removeButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.handbagName} from favorites`}
      >
        <Ionicons name="trash-outline" size={18} color="#B3261E" />
      </Pressable>
    </Pressable>
  );
}

const THUMB_W = 92;
const THUMB_H = 116;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 10,
    marginBottom: 12,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },

  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  genderBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderMale: { backgroundColor: '#4A86C5' },
  genderFemale: { backgroundColor: '#D9729A' },

  info: {
    flex: 1,
    marginLeft: 14,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  textBlock: {
    paddingRight: 40, // chừa chỗ cho nút xóa
  },
  brand: {
    fontSize: 12,
    color: '#77716A',
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  originalPrice: { textDecorationLine: 'line-through', color: '#8A837B', marginRight: 6 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  discountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FBE3E1',
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B3261E',
  },

  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// memo: chỉ vẽ lại khi props thật sự đổi
export default React.memo(FavoriteItem);
