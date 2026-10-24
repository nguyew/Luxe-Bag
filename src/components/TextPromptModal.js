import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Hộp thoại nhập một đoạn chữ (đổi tên brand/category, ghi lý do từ chối trả hàng...).
 * required = true: phải nhập mới bấm xác nhận được.
 * onSubmit(text) được gọi với chữ đã cắt khoảng trắng hai đầu.
 */
export default function TextPromptModal({
  visible,
  title,
  message,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  required = false,
  multiline = false,
  maxLength = 120,
  onSubmit,
  onCancel,
}) {
  const [text, setText] = useState(initialValue);

  // Mỗi lần mở lại thì nạp lại giá trị ban đầu
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const trimmed = text.trim();
  const disabled = required && trimmed.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="#9A948D"
            style={[styles.input, multiline && styles.inputMulti]}
            multiline={multiline}
            maxLength={maxLength}
            autoFocus
            accessibilityLabel={title}
          />

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(trimmed)}
              disabled={disabled}
              style={[styles.confirm, disabled && styles.confirmDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 26, backgroundColor: '#F3F1F1' },
  title: { fontSize: 18, fontWeight: '800', color: '#0D0D0D' },
  message: { marginTop: 6, fontSize: 13, lineHeight: 18, color: '#77716A' },
  input: {
    height: 48,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1A1A1A',
  },
  inputMulti: {
    height: 100,
    paddingTop: 14,
    borderRadius: 20,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancel: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  confirm: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: { backgroundColor: '#B9B2AA' },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
