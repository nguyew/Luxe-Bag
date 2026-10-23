import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bảng chọn dạng bottom sheet (Alert của Android chỉ hiện tối đa 3 nút).
 *
 * Props:
 *  - visible, onClose
 *  - onDismiss: gọi khi bảng đã đóng hẳn (iOS) – dùng để mở ImagePicker
 *  - title
 *  - options: [{ key, label, icon, onPress, destructive? }]
 */
export default function PhotoActionSheet({
  visible,
  onClose,
  onDismiss,
  title,
  options,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          {!!title && <Text style={styles.title}>{title}</Text>}

          {options.map((option) => (
            <Pressable
              key={option.key}
              onPress={option.onPress}
              style={styles.row}
              accessibilityRole="button"
            >
              <View
                style={[styles.iconWrap, option.destructive && styles.iconWrapDanger]}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={option.destructive ? '#B3261E' : '#1A1A1A'}
                />
              </View>
              <Text style={[styles.label, option.destructive && styles.labelDanger]}>
                {option.label}
              </Text>
            </Pressable>
          ))}

          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D3CE',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D0D0D',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: '#FBE3E1',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  labelDanger: {
    color: '#B3261E',
  },
  cancel: {
    marginTop: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
