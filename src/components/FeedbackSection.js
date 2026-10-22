import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StarRating from './StarRating';
import {
  formatFeedbackDate,
  normalizeFeedbacks,
  summarizeFeedbacks,
} from '../utils/feedback';

const LEVELS = [5, 4, 3, 2, 1];

/**
 * Phần feedback ở màn Detail:
 *  - Điểm trung bình + số đánh giá (dạng sao)
 *  - Nhóm theo mức sao (5 -> 1): bấm vào một dòng để chỉ xem mức đó
 *  - Danh sách bình luận
 */
export default function FeedbackSection({ feedbacks: rawFeedbacks }) {
  const [selected, setSelected] = useState(null); // null = xem tất cả

  const feedbacks = useMemo(
    () => normalizeFeedbacks(rawFeedbacks),
    [rawFeedbacks]
  );
  const summary = useMemo(() => summarizeFeedbacks(feedbacks), [feedbacks]);

  const visible = useMemo(
    () =>
      selected === null
        ? feedbacks
        : feedbacks.filter((item) => item.rating === selected),
    [feedbacks, selected]
  );

  if (summary.total === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Ratings & reviews</Text>
        <View style={styles.emptyBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="#77716A" />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptyText}>
            Ratings and comments for this handbag will show up here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Ratings & reviews</Text>

      {/* Tóm tắt + phân nhóm theo sao */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.average}>{summary.average.toFixed(1)}</Text>
          <StarRating value={summary.average} size={15} />
          <Text style={styles.totalText}>
            {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
          </Text>
        </View>

        <View style={styles.summaryRight}>
          {LEVELS.map((level) => {
            const count = summary.counts[level];
            const percent = (count / summary.total) * 100;
            const active = selected === level;
            const disabled = count === 0;

            return (
              <Pressable
                key={level}
                disabled={disabled}
                onPress={() => setSelected(active ? null : level)}
                style={[styles.barRow, active && styles.barRowActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={`${level} star reviews, ${count}`}
              >
                <Text style={styles.barLabel}>{level}</Text>
                <Ionicons name="star" size={11} color="#E8A317" />
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${percent}%` },
                      active && styles.barFillActive,
                    ]}
                  />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Bộ lọc đang chọn */}
      {selected !== null && (
        <View style={styles.filterRow}>
          <Text style={styles.filterText}>
            Showing {selected}-star reviews ({visible.length})
          </Text>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}>
            <Text style={styles.filterClear}>Show all</Text>
          </Pressable>
        </View>
      )}

      {/* Danh sách bình luận */}
      {visible.map((item) => (
        <View key={item.id} style={styles.review}>
          <View style={styles.reviewTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.author.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.reviewMeta}>
              <Text style={styles.author} numberOfLines={1}>
                {item.author}
              </Text>
              <View style={styles.reviewStars}>
                <StarRating value={item.rating} size={12} />
                {!!item.date && (
                  <Text style={styles.date}>{formatFeedbackDate(item.date)}</Text>
                )}
              </View>
            </View>
          </View>

          {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#0D0D0D',
    marginBottom: 14,
  },

  // Tóm tắt
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    gap: 16,
  },
  summaryLeft: {
    alignItems: 'center',
    minWidth: 84,
  },
  average: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: '#0D0D0D',
  },
  totalText: {
    marginTop: 6,
    fontSize: 12,
    color: '#77716A',
  },
  summaryRight: {
    flex: 1,
  },

  // Thanh phân nhóm theo sao
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  barRowActive: {
    backgroundColor: '#F3F1F1',
  },
  barLabel: {
    width: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ECE8E4',
    overflow: 'hidden',
    marginHorizontal: 3,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#B9B2AA',
  },
  barFillActive: {
    backgroundColor: '#E8A317',
  },
  barCount: {
    width: 20,
    fontSize: 12,
    color: '#77716A',
    textAlign: 'right',
  },

  // Bộ lọc
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  filterText: {
    fontSize: 13,
    color: '#55514C',
  },
  filterClear: {
    fontSize: 13,
    fontWeight: '700',
    color: '#050505',
  },

  // Bình luận
  review: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewMeta: {
    flex: 1,
    marginLeft: 12,
  },
  author: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  date: {
    fontSize: 11,
    color: '#77716A',
  },
  comment: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#38342F',
  },

  // Trạng thái rỗng
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#77716A',
  },
});