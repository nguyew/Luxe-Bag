import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackSection from '../components/FeedbackSection';
import ReviewPrompt from '../components/ReviewPrompt';
import RemoteImage from '../components/RemoteImage';
import StarRating from '../components/StarRating';
import useAuth from '../hooks/useAuth';
import useCart from '../hooks/useCart';
import useFavorites from '../hooks/useFavorites';
import { useHandbag } from '../hooks/useHandbags';
import { formatBrand, formatCategory, formatOriginalPrice, formatPercentOff, formatPrice } from '../utils/format';
import { normalizeFeedbacks, summarizeFeedbacks } from '../utils/feedback';
import { getStockStatus, isPurchasable } from '../utils/catalog';
import { tapLight } from '../utils/haptics';

const BAR_HEIGHT = 56;

// Màu cho từng tình trạng hàng
const STOCK_TONES = {
  in: { color: '#1F7A3E', pill: { backgroundColor: '#DFF3E5' } },
  low: { color: '#8A5A00', pill: { backgroundColor: '#FFF1D6' } },
  out: { color: '#B3261E', pill: { backgroundColor: '#FBE3E1' } },
};



export default function DetailScreen({ route, navigation }) {
  // Dữ liệu truyền qua route hiện ngay; bản mới nhất trong kho (ví dụ feedback
  // vừa thêm) sẽ tự thay thế khi có.
  const param = route.params?.handbag;
  const handbag = useHandbag(param?.id, param);
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isLoggedIn } = useAuth();
  const { add } = useCart();

  // Nút "Add to bag" đổi chữ vài giây để báo kết quả
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Điểm trung bình hiển thị ngay dưới tên túi
  const summary = useMemo(
    () => summarizeFeedbacks(normalizeFeedbacks(handbag?.feedbacks)),
    [handbag]
  );

  const flash = useCallback((message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 1800);
  }, []);

  const onAddToBag = useCallback(() => {
    if (!isLoggedIn) {
      navigation.navigate('Login'); // cần tài khoản để mua hàng
      return;
    }
    const result = add(handbag, 1);
    if (result.ok) {
      tapLight();
      flash('Added to your bag');
    } else if (result.reason === 'limit') {
      flash('Maximum quantity in bag');
    } else {
      flash('Out of stock');
    }
  }, [isLoggedIn, navigation, add, handbag, flash]);

  if (!handbag) {
    return (
      <View style={styles.missing}>
        <Ionicons name="bag-outline" size={40} color="#77716A" />
        <Text style={styles.missingTitle}>Handbag not found</Text>
        <Text style={styles.missingText}>Go back and pick another handbag.</Text>
      </View>
    );
  }

  const favorite = isFavorite(handbag.id);
  const discount = formatPercentOff(handbag.percentOff);
  const colors = Array.isArray(handbag.color)
    ? handbag.color
    : handbag.color
    ? [handbag.color]
    : [];
  const hasGender = typeof handbag.gender === 'boolean';
  const purchasable = isPurchasable(handbag);
  const stockStatus = getStockStatus(handbag);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BAR_HEIGHT + insets.bottom + 40 },
        ]}
      >
        {/* Ảnh lớn + gender + yêu thích */}
        <View style={styles.imageWrap}>
          <RemoteImage
            uri={handbag.uri}
            style={StyleSheet.absoluteFill}
            iconSize={64}
          />

          {hasGender && (
            <View
              style={[
                styles.genderBadge,
                handbag.gender ? styles.genderFemale : styles.genderMale,
              ]}
            >
              <Ionicons
                name={handbag.gender ? 'female' : 'male'}
                size={18}
                color="#FFFFFF"
              />
            </View>
          )}

          <Pressable
            onPress={() => toggleFavorite(handbag)}
            style={styles.heartButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? 'Remove from favorites' : 'Add to favorites'
            }
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={22}
              color={favorite ? '#FF4D5E' : '#FFFFFF'}
            />
          </Pressable>
        </View>

        {/* Thông tin chính */}
        {!!handbag.brand && (
          <Text style={styles.brand}>
            {formatBrand(handbag.brand)}
          </Text>
        )}
        <Text style={styles.name}>{handbag.handbagName}</Text>

        {summary.total > 0 && (
          <View style={styles.ratingLine}>
            <StarRating value={summary.average} size={14} />
            <Text style={styles.ratingText}>
              {summary.average.toFixed(1)} ({summary.total})
            </Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(handbag.cost)}</Text>
          {!!formatOriginalPrice(handbag) && (
            <Text style={styles.originalPrice}>{formatOriginalPrice(handbag)}</Text>
          )}
          {!!discount && (
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>{discount} off</Text>
            </View>
          )}
          <View
            style={[styles.stockPill, STOCK_TONES[stockStatus.key].pill]}
            accessibilityLabel={`Availability: ${stockStatus.label}`}
          >
            <Ionicons
              name={stockStatus.icon}
              size={15}
              color={STOCK_TONES[stockStatus.key].color}
            />
            <Text style={[styles.stockText, { color: STOCK_TONES[stockStatus.key].color }]}>
              {stockStatus.label}
            </Text>
          </View>
        </View>

        {/* Thuộc tính */}
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.infoCard}>
          {!!handbag.category && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <View style={styles.infoIcon}>
                  <Ionicons name="grid-outline" size={15} color="#55514C" />
                </View>
                <Text style={styles.infoLabel}>Category</Text>
              </View>
              <Text style={styles.infoValue}>{formatCategory(handbag.category)}</Text>
            </View>
          )}

          {!!handbag.brand && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <View style={styles.infoIcon}>
                  <Ionicons name="ribbon-outline" size={15} color="#55514C" />
                </View>
                <Text style={styles.infoLabel}>Brand</Text>
              </View>
              <Text style={styles.infoValue}>{formatBrand(handbag.brand)}</Text>
            </View>
          )}

          {hasGender && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <View style={styles.infoIcon}>
                  <Ionicons name="person-outline" size={15} color="#55514C" />
                </View>
                <Text style={styles.infoLabel}>For</Text>
              </View>
              <View style={styles.genderValue}>
                <Ionicons
                  name={handbag.gender ? 'female' : 'male'}
                  size={16}
                  color={handbag.gender ? '#D9729A' : '#4A86C5'}
                />
                <Text style={styles.infoValue}>
                  {handbag.gender ? 'Women' : 'Men'}
                </Text>
              </View>
            </View>
          )}

          {colors.length > 0 && (
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <View style={styles.infoLabelWrap}>
                <View style={styles.infoIcon}>
                  <Ionicons name="color-palette-outline" size={15} color="#55514C" />
                </View>
                <Text style={styles.infoLabel}>
                  {colors.length > 1 ? 'Colors' : 'Color'}
                </Text>
              </View>
              <View style={styles.colorList}>
                {colors.map((name) => (
                  <View key={String(name)} style={styles.colorChip}>
                    <Text style={styles.colorText}>{String(name)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Viết đánh giá (chỉ khách đã nhận hàng) + Feedback */}
        <ReviewPrompt handbag={handbag} />
        <FeedbackSection feedbacks={handbag.feedbacks} />
      </ScrollView>

      {/* Thanh cố định ở đáy: yêu thích + thêm vào giỏ */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          onPress={() => toggleFavorite(handbag)}
          style={[styles.favoriteButton, favorite && styles.favoriteButtonOn]}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={22}
            color={favorite ? '#FF4D5E' : '#1A1A1A'}
          />
        </Pressable>

        <Pressable
          onPress={onAddToBag}
          disabled={!purchasable}
          style={[styles.bagButton, !purchasable && styles.bagButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Add to bag"
        >
          <Ionicons name="bag-add-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bagText}>
            {notice || (purchasable ? 'Add to bag' : 'Out of stock')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F1F1',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Ảnh
  imageWrap: {
    width: '100%',
    aspectRatio: 0.98,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  genderBadge: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderMale: { backgroundColor: '#4A86C5' },
  genderFemale: { backgroundColor: '#D9729A' },
  heartButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tiêu đề
  brand: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#9A8F82',
  },
  name: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#0D0D0D',
  },
  ratingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  ratingText: {
    fontSize: 13,
    color: '#55514C',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
    columnGap: 10,
    rowGap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1A1A1A',
  },
  originalPrice: {
    fontSize: 16,
    color: '#8A837B',
    textDecorationLine: 'line-through',
  },
  discountPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FBE3E1',
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B3261E',
  },

  // Thuộc tính
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#0D0D0D',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  infoLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4DFDA',
    gap: 12,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 15,
    color: '#77716A',
  },
  infoValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  genderValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  colorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F1F1',
  },
  colorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38342F',
  },

  // Thanh đáy
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  favoriteButton: {
    width: BAR_HEIGHT - 8,
    height: BAR_HEIGHT - 8,
    borderRadius: (BAR_HEIGHT - 8) / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E4DFDA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonOn: {
    borderColor: '#FF4D5E',
  },
  bagButton: {
    flex: 1,
    height: BAR_HEIGHT - 8,
    borderRadius: (BAR_HEIGHT - 8) / 2,
    backgroundColor: '#050505',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bagButtonDisabled: {
    backgroundColor: '#B9B2AA',
  },
  bagText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Nhãn tồn kho cạnh giá
  stockPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Không có dữ liệu
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F1F1',
    padding: 24,
  },
  missingTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  missingText: {
    marginTop: 6,
    fontSize: 13,
    color: '#77716A',
  },
});