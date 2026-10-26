import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RemoteImage from '../components/RemoteImage';
import StarRating from '../components/StarRating';
import useFavorites from '../hooks/useFavorites';
import useHandbags from '../hooks/useHandbags';
import {
  MAX_REQUEST_LENGTH,
  askStylist,
  describeError,
  isGeminiConfigured,
} from '../services/geminiService';
import { normalizeFeedbacks, summarizeFeedbacks } from '../utils/feedback';
import { formatOriginalPrice, formatPercentOff, formatPrice } from '../utils/format';

const SUGGESTIONS = [
  'A work bag under $600',
  'Something red and elegant',
  'A gift for my mom',
  'Best rated crossbody',
];

let nextId = 1;
const makeId = () => `m${nextId++}`;

// Thẻ gợi ý: ảnh nhỏ, thông tin, lý do của AI, nút tim
const PickCard = React.memo(function PickCard({ pick, favorite, onOpen, onToggle }) {
  const { handbag, reason } = pick;
  const discount = formatPercentOff(handbag.percentOff);
  const reviews = useMemo(
    () => summarizeFeedbacks(normalizeFeedbacks(handbag.feedbacks)),
    [handbag.feedbacks]
  );

  return (
    <Pressable
      onPress={() => onOpen(handbag)}
      style={styles.pick}
      accessibilityRole="button"
      accessibilityLabel={`${handbag.handbagName}, open details`}
    >
      <View style={styles.pickThumb}>
        <RemoteImage uri={handbag.uri} style={StyleSheet.absoluteFill} iconSize={26} />
      </View>

      <View style={styles.pickInfo}>
        <Text style={styles.pickBrand} numberOfLines={1}>
          {handbag.brand}
        </Text>
        <Text style={styles.pickName} numberOfLines={2}>
          {handbag.handbagName}
        </Text>

        <View style={styles.pickMeta}>
          {!!formatOriginalPrice(handbag) && (
            <Text style={styles.pickOriginalPrice}>{formatOriginalPrice(handbag)}</Text>
          )}
          <Text style={styles.pickPrice}>{formatPrice(handbag.cost)}</Text>
          {!!discount && <Text style={styles.pickDiscount}>{discount} off</Text>}
          {reviews.total > 0 && (
            <View style={styles.pickRating}>
              <StarRating value={reviews.average} size={11} />
              <Text style={styles.pickRatingText}>{reviews.average.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {!!reason && <Text style={styles.pickReason}>{reason}</Text>}
      </View>

      <Pressable
        onPress={() => onToggle(handbag)}
        style={styles.pickHeart}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Ionicons
          name={favorite ? 'heart' : 'heart-outline'}
          size={20}
          color={favorite ? '#FF4D5E' : '#55514C'}
        />
      </Pressable>
    </Pressable>
  );
});

export default function StylistScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Danh mục lấy từ kho dùng chung: mở màn hình là có sẵn, không phải chờ tải lại
  const { items: handbags, loading, error, reload: loadCatalog } = useHandbags();
  const catalogState =
    handbags.length > 0 ? 'ready' : loading ? 'loading' : error ? 'error' : 'ready';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort(); // rời màn hình thì hủy yêu cầu
    };
  }, []);

  // Gửi một yêu cầu cho AI (dùng cả cho "Try again")
  const run = useCallback(
    async (request) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setThinking(true);

      try {
        const result = await askStylist(request, handbags, {
          signal: controller.signal,
        });
        if (!mountedRef.current || controller.signal.aborted) return;
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', reply: result.reply, picks: result.picks },
        ]);
      } catch (error) {
        if (!mountedRef.current || error?.name === 'AbortError') return;
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'error', text: describeError(error), request },
        ]);
      } finally {
        if (mountedRef.current && abortRef.current === controller) setThinking(false);
      }
    },
    [handbags]
  );

  const send = useCallback(
    (text) => {
      const request = String(text ?? '').trim();
      if (!request || thinking || catalogState !== 'ready') return;

      setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: request }]);
      setInput('');
      run(request);
    },
    [thinking, catalogState, run]
  );

  const retry = useCallback(
    (message) => {
      if (thinking) return;
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      run(message.request);
    },
    [thinking, run]
  );

  const openDetail = useCallback(
    (handbag) => navigation.navigate('Detail', { handbag }),
    [navigation]
  );

  const canSend = input.trim().length > 0 && !thinking && catalogState === 'ready';

  let body;
  if (!isGeminiConfigured) {
    body = (
      <View style={styles.notice}>
        <Ionicons name="key-outline" size={34} color="#77716A" />
        <Text style={styles.noticeTitle}>AI Stylist isn’t set up</Text>
        <Text style={styles.noticeText}>
          Add your Gemini API key to the .env file, then restart Expo with
          “npx expo start -c”.
        </Text>
        <Text style={styles.noticeCode}>EXPO_PUBLIC_GEMINI_API_KEY=your_key</Text>
      </View>
    );
  } else if (catalogState === 'error') {
    body = (
      <View style={styles.notice}>
        <Ionicons name="cloud-offline-outline" size={34} color="#77716A" />
        <Text style={styles.noticeTitle}>Couldn’t load the collection</Text>
        <Text style={styles.noticeText}>Check your connection and try again.</Text>
        <Pressable onPress={loadCatalog} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (messages.length === 0) {
    body = (
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="sparkles" size={26} color="#FFFFFF" />
        </View>
        <Text style={styles.introTitle}>Your personal stylist</Text>
        <Text style={styles.introText}>
          Tell me the occasion, color or budget, and I’ll pick handbags from our
          collection.
        </Text>

        <View style={styles.chips}>
          {SUGGESTIONS.map((text) => (
            <Pressable
              key={text}
              onPress={() => send(text)}
              disabled={catalogState !== 'ready'}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{text}</Text>
            </Pressable>
          ))}
        </View>

        {catalogState === 'loading' && (
          <ActivityIndicator color="#292725" style={styles.introLoader} />
        )}
      </View>
    );
  } else {
    body = null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding" // Android cũng cần: Expo SDK 54+ luôn dùng giao diện tràn viền
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {body}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <View key={message.id} style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
            );
          }

          if (message.role === 'error') {
            return (
              <View key={message.id} style={[styles.bubble, styles.errorBubble]}>
                <Text style={styles.errorText}>{message.text}</Text>
                <Pressable onPress={() => retry(message)} hitSlop={8}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            );
          }

          return (
            <View key={message.id} style={styles.assistantBlock}>
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={styles.assistantText}>{message.reply}</Text>
              </View>

              {message.picks.map((pick) => (
                <PickCard
                  key={pick.handbag.id}
                  pick={pick}
                  favorite={isFavorite(pick.handbag.id)}
                  onOpen={openDetail}
                  onToggle={toggleFavorite}
                />
              ))}
            </View>
          );
        })}

        {thinking && (
          <View style={[styles.bubble, styles.assistantBubble, styles.thinking]}>
            <ActivityIndicator size="small" color="#55514C" />
            <Text style={styles.thinkingText}>Stylist is choosing…</Text>
          </View>
        )}
      </ScrollView>

      {isGeminiConfigured && (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputBox}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Describe what you’re looking for"
              placeholderTextColor="#9A948D"
              style={styles.input}
              maxLength={MAX_REQUEST_LENGTH}
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              editable={catalogState === 'ready'}
              accessibilityLabel="Describe what you are looking for"
            />
            <Pressable
              onPress={() => send(input)}
              disabled={!canSend}
              style={[styles.sendButton, !canSend && styles.sendButtonOff]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>
            AI picks may not always be perfect. Check the details before buying.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F1F1',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
    flexGrow: 1,
  },

  // Giới thiệu
  intro: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 12,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: '#0D0D0D',
  },
  introText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#77716A',
    paddingHorizontal: 12,
  },
  chips: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  introLoader: {
    marginTop: 20,
  },

  // Thông báo (chưa cấu hình / lỗi tải)
  notice: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 12,
  },
  noticeTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  noticeText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#77716A',
  },
  noticeCode: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    fontSize: 12,
    color: '#38342F',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  primaryButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Bong bóng chat
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    marginTop: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#050505',
    borderBottomRightRadius: 8,
  },
  userText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  assistantBlock: {
    alignItems: 'flex-start',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
  },
  assistantText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1A1A1A',
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBE3E1',
    borderBottomLeftRadius: 8,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#8C1D18',
  },
  retryText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#B3261E',
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    fontSize: 13,
    color: '#55514C',
  },

  // Thẻ gợi ý
  pick: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 10,
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  pickThumb: {
    width: 84,
    height: 104,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E7E3DF',
  },
  pickInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 30, // chừa chỗ cho nút tim
  },
  pickBrand: {
    fontSize: 11,
    color: '#77716A',
  },
  pickName: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pickMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  pickPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pickOriginalPrice: {
    fontSize: 12,
    color: '#8A837B',
    textDecorationLine: 'line-through',
  },
  pickDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B3261E',
  },
  pickRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickRatingText: {
    fontSize: 11,
    color: '#55514C',
  },
  pickReason: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#55514C',
  },
  pickHeart: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // Ô nhập
  inputBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#F3F1F1',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DFDA',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1A1A1A',
    padding: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonOff: {
    backgroundColor: '#C9C4BE',
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 11,
    textAlign: 'center',
    color: '#9A948D',
  },
});
