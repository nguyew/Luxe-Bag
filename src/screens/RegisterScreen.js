import React, { useCallback, useRef, useState } from 'react';
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
import {
  NAME_MAX_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from '../utils/validation';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const submit = useCallback(async () => {
    if (busy) return;

    const nextErrors = {};
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (!passwordError && confirm !== password) {
      nextErrors.confirm = 'Passwords do not match.';
    }
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      // Backend gửi mã 6 số qua email, chưa đăng nhập: chuyển sang màn xác minh
      const result = await register({ name, email, password });
      navigation.replace('VerifyEmail', { email: result.email, sendCode: result.alreadyPending });
    } catch (error) {
      if (error?.code === 'email_taken') {
        setErrors({ email: describeAuthError(error) });
      } else {
        setFormError(describeAuthError(error));
      }
      setBusy(false);
    }
  }, [busy, name, email, password, confirm, register, navigation]);

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
          onPress={() => navigation.goBack()}
          style={styles.close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Create your</Text>
          <Text style={styles.heroBold}>account.</Text>
          <Text style={styles.heroSub}>
            Save favorites, order handbags and track your purchases.
          </Text>
        </View>

        <AuthField
          label="Full name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="Your name"
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="At least 6 characters"
          secure
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          blurOnSubmit={false}
        />

        <AuthField
          ref={confirmRef}
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
          placeholder="Repeat your password"
          secure
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />

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
            <Text style={styles.primaryText}>Create account</Text>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account?</Text>
          <Pressable
            onPress={() => navigation.replace('Login')}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.switchLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F1F1' },
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
    gap: 6,
    marginTop: 22,
  },
  switchText: { fontSize: 13, color: '#77716A' },
  switchLink: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
});