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
import RemoteImage from '../components/RemoteImage';
import StarPicker from '../components/StarPicker';
import useAuth from '../hooks/useAuth';
import { useHandbag } from '../hooks/useHandbags';
import {
  REVIEW_MAX_LENGTH,
  deleteOwnReview,
  describeReviewError,
  submitReview,
} from '../services/reviewService';

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Viết hoặc sửa đánh giá của chính mình cho một sản phẩm đã nhận. */
export default function ReviewFormScreen({ navigation, route }) {
  const { handbagId } = route.params;
  const { user } = useAuth();
  const handbag = useHandbag(handbagId, undefined);

  const own = (Array.isArray(handbag?.feedbacks) ? handbag.feedbacks : []).find(
    (item) => item && item.userId && user && String(item.userId) === String(user.id)
  );

  const [rating, setRating] = useState(own ? Math.round(Number(own.rating)) || 0 : 0);
  const [comment, setComment] = useState(own?.comment || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (busy || !user) return;
    if (rating < 1) {
      setError('Please tap the stars to rate this item.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await submitReview({ user, handbagId, rating, comment });
      navigation.goBack();
    } catch (e) {
      setError(describeReviewError(e));
      setBusy(false);
    }
  }, [busy, user, handbagId, rating, comment, navigation]);

  const confirmDelete = () => {
    Alert.alert('Delete your review?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteOwnReview({ userId: user.id, handbagId });
            navigation.goBack();
          } catch (e) {
            setBusy(false);
            Alert.alert('Review', describeReviewError(e));
          }
        },
      },
    ]);
  };

  if (!handbag) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="alert-circle-outline" size={44} color="#77716A" />
        <Text style={styles.notFound}>Product not found</Text>
      </View>
    );
  }

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
        <View style={styles.product}>
          <View style={styles.thumb}>
            <RemoteImage uri={handbag.uri} style={styles.thumbImage} />
          </View>
          <View style={styles.productText}>
            {!!handbag.brand && <Text style={styles.brand}>{handbag.brand}</Text>}
            <Text style={styles.name} numberOfLines={2}>
              {handbag.handbagName}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Your rating</Text>
        <StarPicker value={rating} onChange={setRating} />
        <Text style={styles.ratingWord}>{RATING_WORDS[rating] || ' '}</Text>

        <Text style={styles.label}>Your review (optional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="What did you like or dislike?"
          placeholderTextColor="#9A948D"
          style={styles.input}
          multiline
          maxLength={REVIEW_MAX_LENGTH}
          accessibilityLabel="Your review"
        />
        <Text style={styles.counter}>
          {comment.length}/{REVIEW_MAX_LENGTH}
        </Text>

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
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>{own ? 'Save changes' : 'Submit review'}</Text>
          )}
        </Pressable>

        {!!own && (
          <Pressable
            onPress={confirmDelete}
            disabled={busy}
            style={styles.danger}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color="#B3261E" />
            <Text style={styles.dangerText}>Delete my review</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 20, paddingBottom: 48 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    marginBottom: 24,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  thumb: { width: 56, height: 70, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E7E3DF' },
  thumbImage: { width: '100%', height: '100%' },
  productText: { flex: 1 },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#77716A',
  },
  name: { marginTop: 2, fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#1A1A1A' },
  label: {
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#55514C',
  },
  ratingWord: {
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#8A5A00',
  },
  input: {
    minHeight: 120,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
    color: '#1A1A1A',
    textAlignVertical: 'top',
  },
  counter: { marginTop: 6, marginRight: 8, textAlign: 'right', fontSize: 11, color: '#9A948D' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FBE3E1',
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#B3261E' },
  primary: {
    height: 52,
    marginTop: 20,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.7 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  danger: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    marginTop: 16,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: '#FBE3E1',
  },
  dangerText: { fontSize: 14, fontWeight: '700', color: '#B3261E' },
});
