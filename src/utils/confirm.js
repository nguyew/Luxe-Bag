/**
 * Hộp thoại xác nhận / thông báo chạy được trên cả iOS, Android và Web.
 *
 * Vì sao cần: `Alert.alert` của react-native-web là hàm rỗng, nên trên web
 * các nút xác nhận (ví dụ "Cancel order") bấm vào không có gì xảy ra.
 * Trên web dùng window.confirm / window.alert; trên mobile giữ nguyên Alert.
 */
import { Alert, Platform } from 'react-native';

/**
 * Hỏi xác nhận một hành động.
 * @param {{title: string, message?: string, confirmText?: string, cancelText?: string,
 *          destructive?: boolean, onConfirm: () => void}} options
 */
export function confirmAction({
  title,
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
}) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && window.confirm(text)) onConfirm?.();
    return;
  }
  Alert.alert(title, message || undefined, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Thông báo một dòng (lỗi / thành công). */
export function showMessage(title, message = '') {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message || undefined);
}
