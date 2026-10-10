import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatPercentOff, formatPrice } from '../utils/format';

/**
 * Thẻ túi xách dùng chung (Home, Favorites, Search).
 *
 * Props:
 *  - item:       object handbag từ API { id, handbagName, brand, cost, percentOff, gender, uri, color }
 *  - wide:       true -> thẻ ngang (full width), mặc định thẻ đứng
 *  - onOpen:     gọi khi bấm vào thẻ, nhận lại item (mở Detail)
 *  - isFavorite: đã yêu thích hay chưa
 *  - onFavorite: gọi khi bấm nút yêu thích, nhận lại item
 */
function HandbagCard({ item, wide, onOpen, isFavorite, onFavorite }) {
  const [imageFailed, setImageFailed] = useState(false);

  // API trả `color` là mảng tên màu (["Red"]), chỉ dùng làm nền khi là mã hex
  const backgroundColor =
    typeof item.color === 'string' && item.color.startsWith('#')
      ? item.color
      : '#E7E3DF';

  return (
    <Pressable
      onPress={() => onOpen?.(item)}
      style={[
        styles.productCard,
        wide ? styles.wideCard : styles.squareCard,
        { backgroundColor },
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

      {/* Lớp phủ tối dần ở đáy để chữ trắng luôn đọc được trên ảnh sáng */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']}
        locations={[0, 1]}
        style={styles.bottomScrim}
      />

      {/* Nút yêu thích: trái tim rỗng -> trái tim đầy khi đã thích */}
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          onFavorite(item);
        }}
        style={styles.favoriteButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite ? 'Remove from favorites' : 'Add to favorites'
        }
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={18}
          color={isFavorite ? '#FF4D5E' : '#FFFFFF'}
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

      {/* Caption đè lên ảnh.
          - Thẻ đứng: brand + tên (tối đa 2 dòng) ở trên, giá + % giảm ở dưới.
          - Thẻ rộng: brand + tên bên trái, giá + % giảm bên phải. */}
      <View style={[styles.productCaption, !wide && styles.captionStacked]}>
        <View style={[styles.captionLeft, !wide && styles.captionLeftStacked]}>
          {!!item.brand && (
            <Text style={styles.productCaptionBrand} numberOfLines={1}>
              {item.brand}
            </Text>
          )}
          <Text style={styles.productCaptionName} numberOfLines={2}>
            {item.handbagName}
          </Text>
        </View>

        <View style={[styles.captionRight, !wide && styles.captionRightRow]}>
          <Text style={styles.productCaptionPrice}>
            {formatPrice(item.cost)}
          </Text>
          {!!formatPercentOff(item.percentOff) && (
            <View style={[styles.discountPill, !wide && styles.discountPillRow]}>
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

  // Nút yêu thích (ô vuông bo góc, nền tối mờ)
  favoriteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
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
  // Thẻ đứng: xếp dọc để tên có đủ bề ngang cho 2 dòng
  captionStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  captionLeftStacked: {
    flex: 0,
    marginRight: 0,
    marginBottom: 6,
  },
  captionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    lineHeight: 16,
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

  discountPillRow: {
    marginTop: 0,
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

// memo: thẻ chỉ vẽ lại khi props thật sự đổi (quan trọng khi cuộn FlatList)
export default React.memo(HandbagCard);