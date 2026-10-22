import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Hiển thị điểm đánh giá bằng 5 ngôi sao (hỗ trợ nửa sao, ví dụ 4.5).
 */
function StarRating({ value = 0, size = 14, color = '#E8A317', style }) {
  const stars = [1, 2, 3, 4, 5].map((n) => {
    let name = 'star-outline';
    if (value >= n - 0.25) name = 'star';
    else if (value >= n - 0.75) name = 'star-half';

    return <Ionicons key={n} name={name} size={size} color={color} />;
  });

  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
      accessibilityRole="image"
      accessibilityLabel={`${Number(value).toFixed(1)} out of 5 stars`}
    >
      {stars}
    </View>
  );
}

export default React.memo(StarRating);