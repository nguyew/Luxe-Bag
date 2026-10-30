import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthField from '../components/AuthField';
import useAuth from '../hooks/useAuth';
import { describeAuthError } from '../services/userService';

// Backend chỉ cho gửi lại mã sau mỗi 60 giây
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/** "lich.nguyen@gmail.com" -> "li********@gmail.com" */
export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return String(email || '');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 2))}@${domain}`;
}

/**
 * Nhập mã 6 số được gửi qua email để kích hoạt tài khoản.
 * route.params: { email, sendCode } – sendCode = true thì tự xin mã mới khi mở màn
 * (dùng khi đăng nhập vào tài khoản chưa xác minh).
 * Xác minh thành công -> đăng nhập luôn, navigator tự bỏ nhóm màn hình đăng nhập.
 */
export default function VerifyEmailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { verifyEmail, resendVerification } = useAuth();
  const email = String(route.params?.email || '').trim().toLowerCase();
  const sendOnOpen = route.params?.sendCode === true;

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Đăng ký xong thì Backend vừa gửi mã -> chờ đủ 60s mới cho gửi lại
  const [cooldown, setCooldown] = useState(sendOnOpen ? 0 : RESEND_SECONDS);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = useCallback(async () => {
    if (!email) return;
    setResending(true);
    setFormError('');
    setInfo('');
    try {
      await resendVerification(email);
      if (!mounted.current) return;
      setInfo(`We sent a new 6-digit code to ${maskEmail(email)}.`);
      setCooldown(RESEND_SECONDS);
    } catch (error) {
      if (!mounted.current) return;
      if (error?.code === 'rate_limited') {
        // Vừa gửi mã cách đây chưa lâu: mã trong hộp thư vẫn dùng được
        setInfo('A code was sent a moment ago. Check your inbox (and spam folder).');
        setCooldown(RESEND_SECONDS);
      } else {
        setFormError(describeAuthError(error));
      }
    } finally {
      if (mounted.current) setResending(false);
    }
  }, [email, resendVerification]);

  // Mở từ màn đăng nhập (tài khoản chưa xác minh): tự gửi mã mới đúng một lần
  const autoSent = useRef(false);
  useEffect(() => {
    if (!sendOnOpen || autoSent.current) return;
    autoSent.current = true;
    requestCode();
  }, [sendOnOpen, requestCode]);

  const submit = useCallback(async () => {
    if (busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== CODE_LENGTH) {
      setCodeError('Enter the 6-digit code from your email.');
      return;
    }
    setCodeError('');
    setFormError('');
    setBusy(true);
    try {
      await verifyEmail(email, digits);
      // Thành công: đã đăng nhập, navigator tự đóng các màn hình đăng nhập
    } catch (error) {
      if (!mounted.current) return;
      setFormError(describeAuthError(error));
      setBusy(false);
    }
  }, [busy, code, email, verifyEmail]);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  if (!email) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.heroSub}>Missing email address.</Text>
        <Pressable onPress={() => navigation.replace('Login')} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={close}
          style={styles.close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-open-outline" size={28} color="#1A1A1A" />
          </View>
          <Text style={styles.heroTitle}>Verify your</Text>
          <Text style={styles.heroBold}>email.</Text>
          <Text style={styles.heroSub}>
            We sent a 6-digit code to {maskEmail(email)}. Enter it below to finish setting up your
            account.
          </Text>
        </View>

        <AuthField
          label="Verification code"
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          error={codeError}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.codeInput}
        />

        {!!info && (
          <View style={styles.info} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={16} color="#1F7A3E" />
            <Text style={styles.infoText}>{info}</Text>
          </View>
        )}

        {!!formError && (
          <View style={styles.formError} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={16} color="#B3261E" />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.primaryBusy]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Verify email</Text>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Didn’t get the code?</Text>
          {resending ? (
            <ActivityIndicator size="small" color="#1A1A1A" />
          ) : cooldown > 0 ? (
            <Text style={styles.switchWait}>Resend in {cooldown}s</Text>
          ) : (
            <Pressable onPress={requestCode} hitSlop={8} accessibilityRole="button">
              <Text style={styles.switchLink}>Resend code</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Wrong email?</Text>
          <Pressable onPress={() => navigation.replace('Register')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.switchLink}>Start over</Text>
          </Pressable>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already verified?</Text>
          <Pressable onPress={() => navigation.replace('Login')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.switchLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  close: {
    alignSelf: 'flex-end',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { paddingTop: 12, paddingBottom: 28 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  heroBold: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: '#0D0D0D',
    fontWeight: '800',
  },
  heroSub: { marginTop: 10, fontSize: 14, lineHeight: 20, color: '#77716A' },
  codeInput: { fontSize: 22, letterSpacing: 6, fontWeight: '700' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#DFF3E5',
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#1F7A3E' },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#FBE3E1',
  },
  formErrorText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#B3261E' },
  primary: {
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBusy: { opacity: 0.7 },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  switchText: { fontSize: 13, color: '#77716A' },
  switchLink: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  switchWait: { fontSize: 13, fontWeight: '600', color: '#9A948D' },
});