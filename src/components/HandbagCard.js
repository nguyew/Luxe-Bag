import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPercentOff, formatPrice } from '../utils/format';

/**
 * Thẻ túi xách dùng chung (Home, Favorites, Search).
 *
 * Props:
 *  - item:       object handbag từ API { id, handbagName, brand, cost, percentOff, gender, uri, color }
 *  - wide:       true -> thẻ ngang (full width), mặc định thẻ đứng
 *  - onOpen:     gọi khi bấm vào thẻ (mở Detail)
 *  - isFavorite: đã yêu thích hay chưa
 *  - onFavorite: gọi khi bấm nút yêu thích, nhận lại item
 */
export default function HandbagCard({ item, wide, onOpen, isFavorite, onFavorite }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      onPress={onOpen}
      style={[
        styles.productCard,
        wide ? styles.wideCard : styles.squareCard,
        { backgroundColor: item.color || '#D8D8D8' },
      ]}
    >
      {!imageFailed && item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="bag-outline" size={48} color="#FFFFFF" />
        </View>
      )}

      {/* Nút túi / yêu thích: ô vuông bo góc, nền trắng mờ */}
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          onFavorite(item);
        }}
        style={styles.bagAction}
        hitSlop={8}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'bag-outline'}
          size={16}
          color={isFavorite ? '#B74B42' : '#FFFFFF'}
        />
      </Pressable>

      {/* Gender: false -> icon nam (xanh), true -> icon nữ (hồng) */}
      {typeof item.gender === 'boolean' && (
        <View
          style={[
            styles.genderBadge,
            item.gender ? styles.genderFemale : styles.genderMale,
          ]}
        >
          <Ionicons
            name={item.gender ? 'female' : 'male'}
            size={16}
            color="#FFFFFF"
          />
        </View>
      )}

      {/* Mô tả bên phải – chỉ có ở thẻ rộng */}
      {wide && (
        <Text style={styles.wideDescriptionText}>
          For everyday{'\n'}sophistication.
        </Text>
      )}

      {/* Brand + tên (trái), giá + % giảm (phải) đè lên ảnh */}
      <View style={styles.productCaption}>
        <View style={styles.captionLeft}>
          {!!item.brand && (
            <Text style={styles.productCaptionBrand} numberOfLines={1}>
              {item.brand}
            </Text>
          )}
          <Text style={styles.productCaptionName} numberOfLines={1}>
            {item.handbagName}
          </Text>
        </View>

        <View style={styles.captionRight}>
          <Text style={styles.productCaptionPrice}>
            {formatPrice(item.cost)}
          </Text>
          {!!formatPercentOff(item.percentOff) && (
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>
                {formatPercentOff(item.percentOff)} off
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  productCard: {
    overflow: 'hidden',
    borderRadius: 26,
    position: 'relative',
  },

  squareCard: {
    width: '100%',
    aspectRatio: 0.74, // thẻ đứng giống ảnh
  },

  wideCard: {
    width: '100%',
    aspectRatio: 2.3, // thẻ ngang
  },

  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nút túi (ô vuông bo góc, mờ)
  bagAction: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tên + giá đè trên ảnh
  productCaption: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  captionLeft: {
    flex: 1,
    marginRight: 6,
  },

  captionRight: {
    alignItems: 'flex-end',
  },

  productCaptionBrand: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  productCaptionName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  productCaptionPrice: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Huy hiệu gender (góc trên trái)
  genderBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  genderMale: {
    backgroundColor: '#4A86C5',
  },

  genderFemale: {
    backgroundColor: '#D9729A',
  },

  // % giảm giá
  discountPill: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B3261E',
  },

  // Mô tả trên thẻ rộng
  wideDescriptionText: {
    position: 'absolute',
    right: 14,
    bottom: 70,
    color: '#1F1F1F',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
});