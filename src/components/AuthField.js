import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Ô nhập cho form đăng nhập / đăng ký: nhãn, ô nhập, thông báo lỗi.
 * Nếu `secure` = true thì có nút hiện/ẩn mật khẩu.
 * Các props còn lại được chuyển thẳng cho TextInput.
 */
const AuthField = forwardRef(function AuthField(
  { label, error, secure, style, ...inputProps },
  ref
) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.box, !!error && styles.boxError]}>
        <TextInput
          ref={ref}
          placeholderTextColor="#9A948D"
          style={[styles.input, style]}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
        />

        {secure && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#77716A"
            />
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    marginBottom: 6,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#55514C',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 10,
  },
  boxError: { borderColor: '#B3261E' },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontSize: 15,
    color: '#1A1A1A',
  },
  error: {
    marginTop: 6,
    marginLeft: 8,
    fontSize: 12,
    color: '#B3261E',
  },
});

export default AuthField;
