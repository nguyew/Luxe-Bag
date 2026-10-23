import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

/**
 * Ảnh từ internet dùng chung cho mọi màn hình.
 *  - expo-image: cache trên bộ nhớ + đĩa, ảnh đã xem hiện lại ngay khi
 *    quay lại màn hình, và mờ dần vào thay vì nháy.
 *  - Lỗi tải ảnh hoặc không có đường dẫn -> hiện icon túi thay thế.
 *
 * Props: uri, style, iconSize, contentFit
 */
function RemoteImage({ uri, style, iconSize = 32, contentFit = 'cover' }) {
  // Nhớ đường dẫn bị lỗi (thay vì true/false) để đổi sang ảnh khác là tự thử lại
  const [failedUri, setFailedUri] = useState(null);

  if (!uri || failedUri === uri) {
    return (
      <View style={[style, styles.fallback]}>
        <Ionicons name="bag-outline" size={iconSize} color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={180}
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(RemoteImage);