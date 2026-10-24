import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import StarRating from './StarRating';
import useAuth from '../hooks/useAuth';
import { hasDeliveredPurchase } from '../services/reviewService';

/**
 * Khối "Viết đánh giá" ở màn Detail, đặt trên danh sách feedback.
 *  - Đã đánh giá       -> hiện sao đã chấm + nút Edit
 *  - Đã nhận hàng      -> nút Write a review
 *  - Chưa nhận hàng    -> ghi chú ngắn: chỉ khách đã nhận hàng mới đánh giá được
 *  - Khách chưa đăng nhập / mất mạng khi kiểm tra -> không hiện gì
 */
export default function ReviewPrompt({ handbag }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [eligible, setEligible] = useState(null); // null = đang kiểm tra / không rõ

  const userId = user?.id;
  const handbagId = handbag.id;
  const own = userId
    ? (Array.isArray(handbag.feedbacks) ? handbag.feedbacks : []).find(
        (item) => item && item.userId && String(item.userId) === String(userId)
      )
    : null;

  // Chỉ cần kiểm tra đơn hàng khi khách chưa có đánh giá cho sản phẩm này
  useEffect(() => {
    setEligible(null);
    if (!userId || own) return undefined;

    let cancelled = false;
    hasDeliveredPurchase(userId, handbagId)
      .then((ok) => {
        if (!cancelled) setEligible(ok);
      })
      .catch(() => {
        // mất mạng: không hiện gì
      });
    return () => {
      cancelled = true;
    };
  }, [userId, handbagId, !!own]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!userId) return null;

  const open = () => navigation.navigate('ReviewForm', { handbagId });

  if (own) {
    return (
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>Your review</Text>
          <StarRating value={Number(own.rating) || 0} size={16} />
          {own.hidden === true && (
            <Text style={styles.hidden}>Hidden by the store – only you can see this.</Text>
          )}
        </View>
        <Pressable onPress={open} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Edit</Text>
        </Pressable>
      </View>
    );
  }

  if (eligible === true) {
    return (
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>How was it?</Text>
          <Text style={styles.sub}>Share your thoughts with other shoppers.</Text>
        </View>
        <Pressable onPress={open} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Write a review</Text>
        </Pressable>
      </View>
    );
  }

  if (eligible === false) {
    return (
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color="#77716A" />
        <Text style={styles.noteText}>
          Only customers who received this item can leave a review.
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  texts: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '800', color: '#0D0D0D' },
  sub: { fontSize: 12, color: '#77716A' },
  hidden: { fontSize: 11, color: '#B3261E' },
  button: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 12, color: '#77716A' },
});
