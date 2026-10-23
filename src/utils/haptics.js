import * as Haptics from 'expo-haptics';

// Rung nhẹ khi bấm: giúp app có cảm giác "native". Lỗi (web, máy không hỗ trợ)
// thì bỏ qua, không ảnh hưởng chức năng.
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapSelect() {
  Haptics.selectionAsync().catch(() => {});
}
