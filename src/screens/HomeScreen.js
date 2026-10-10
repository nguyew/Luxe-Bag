import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getHandbags } from '../services/api';

const SAMPLE_BAGS = [
  {
    id: '1',
    handbagName: 'The Muse',
    brand: 'Bvlgari',
    category: 'Shoulder',
    cost: 180,
    percentOff: 0.3,
    color: '#7194B7',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
  },
  {
    id: '2',
    handbagName: 'The Nomad',
    brand: 'Fendi',
    category: 'Evening',
    cost: 220,
    percentOff: 0.2,
    color: '#77452D',
    uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
  },
  {
    id: '3',
    handbagName: 'Soft Clutch',
    brand: 'Burberry',
    category: 'Tote',
    cost: 150,
    percentOff: 0.15,
    color: '#A8C5D0',
    uri: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=900',
  },
  {
    id: '4',
    handbagName: 'Classic Mini',
    brand: 'Ferragamo',
    category: 'Shoulder',
    cost: 260,
    percentOff: 0.25,
    color: '#D6B16C',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
  },
  {
    id: '5',
    handbagName: 'Everyday Bag',
    brand: 'Michael Kors',
    category: 'Tote',
    cost: 190,
    percentOff: 0.1,
    color: '#B7C9B5',
    uri: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
  },
];

const CATEGORIES = ['All', 'Shoulder', 'Evening', 'Tote'];

const formatPrice = (price) =>
  `$${Number(price || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;

function ProductCard({ item, wide, onOpen, isFavorite, onFavorite }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      onPress={onOpen}
      style={[
        styles.productCard,
        wide ? styles.wideCard : styles.squareCard,
        { backgroundColor: item.color || '#D8D8D8' },
      ]}
    >
      {!imageFailed && item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="bag-outline" size={48} color="#FFFFFF" />
        </View>
      )}

      {/* Nút túi / yêu thích: ô vuông bo góc, nền trắng mờ */}
      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          onFavorite(item);
        }}
        style={styles.bagAction}
        hitSlop={8}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'bag-outline'}
          size={16}
          color={isFavorite ? '#B74B42' : '#FFFFFF'}
        />
      </Pressable>

      {/* Mô tả bên phải – chỉ có ở thẻ rộng */}
      {wide && (
        <Text style={styles.wideDescriptionText}>
          For everyday{'\n'}sophistication.
        </Text>
      )}

      {/* Tên + giá nằm đè lên ảnh, góc dưới */}
      <View style={styles.productCaption}>
        <Text style={styles.productCaptionName} numberOfLines={1}>
          {item.handbagName}
        </Text>
        <Text style={styles.productCaptionPrice}>{formatPrice(item.cost)}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [handbags, setHandbags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        const data = await getHandbags();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setHandbags(
            data.map((item) => ({
              ...item,
              color: item.color || '#A8B9C8',
              uri: item.uri || item.image || item.imageUrl || '',
            }))
          );
        } else if (mounted) {
          setHandbags(SAMPLE_BAGS);
        }
      } catch {
        if (mounted) setHandbags(SAMPLE_BAGS);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  // Giữ nguyên thứ tự dữ liệu (giống ảnh: Muse → Nomad → Soft Clutch)
  const filteredProducts = useMemo(() => {
    return handbags.filter((item) => {
      if (selectedCategory === 'All') return true;
      return (
        String(item.category || '').toLowerCase() ===
        selectedCategory.toLowerCase()
      );
    });
  }, [handbags, selectedCategory]);

  const toggleFavorite = (item) => {
    setFavoriteIds((previous) =>
      previous.includes(String(item.id))
        ? previous.filter((id) => id !== String(item.id))
        : [...previous, String(item.id)]
    );
  };

  const openDetail = (item) => {
    navigation.navigate('Detail', { handbag: item });
  };

  // Mẫu lặp: 2 thẻ vuông cạnh nhau → 1 thẻ rộng → lặp lại
  const renderProductRows = () => {
    const rows = [];
    let index = 0;

    while (index < filteredProducts.length) {
      const first = filteredProducts[index];
      const second = filteredProducts[index + 1];

      rows.push(
        <View key={`row-${first.id}`} style={styles.productRow}>
          <View style={styles.productColumn}>
            <ProductCard
              item={first}
              onOpen={() => openDetail(first)}
              onFavorite={toggleFavorite}
              isFavorite={favoriteIds.includes(String(first.id))}
            />
          </View>

          <View style={styles.productColumn}>
            {second && (
              <ProductCard
                item={second}
                onOpen={() => openDetail(second)}
                onFavorite={toggleFavorite}
                isFavorite={favoriteIds.includes(String(second.id))}
              />
            )}
          </View>
        </View>
      );

      index += 2;

      if (index < filteredProducts.length) {
        const wideItem = filteredProducts[index];

        rows.push(
          <ProductCard
            key={`wide-${wideItem.id}`}
            item={wideItem}
            wide
            onOpen={() => openDetail(wideItem)}
            onFavorite={toggleFavorite}
            isFavorite={favoriteIds.includes(String(wideItem.id))}
          />
        );

        index += 1;
      }
    }

    return rows;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F1F1" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header: menu trái, search phải, không có logo */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('Search')}
            style={styles.headerButton}
            hitSlop={8}
          >
            <Ionicons name="menu-outline" size={26} color="#1A1A1A" />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Search')}
            style={styles.headerButton}
            hitSlop={8}
          >
            <Ionicons name="search-outline" size={24} color="#1A1A1A" />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Designed for elegance.</Text>
          <Text style={styles.heroBold}>Built for life.</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[styles.categoryChip, active && styles.activeChip]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.activeChipText,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#292725"
            style={styles.loader}
          />
        ) : filteredProducts.length > 0 ? (
          <View style={styles.products}>{renderProductRows()}</View>
        ) : (
          <Text style={styles.emptyText}>No handbags in this category.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F1F1',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110, // chừa chỗ cho tab bar nổi
  },

  // Header
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    paddingTop: 22,
    paddingBottom: 22,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  heroBold: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: '#0D0D0D',
    fontWeight: '800',
  },

  // Category chips
  categoryList: {
    gap: 6,
    paddingBottom: 22,
    alignItems: 'center',
  },
  categoryChip: {
    minHeight: 32,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activeChip: {
    backgroundColor: '#050505',
  },
  categoryText: {
    fontSize: 13,
    color: '#55514C',
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Product grid
  products: {
    gap: 12,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
  },
  productColumn: {
    flex: 1,
    minWidth: 0,
  },
  productCard: {
    overflow: 'hidden',
    borderRadius: 26,
    position: 'relative',
  },
  squareCard: {
    width: '100%',
    aspectRatio: 0.74, // thẻ đứng giống ảnh
  },
  wideCard: {
    width: '100%',
    aspectRatio: 2.3, // thẻ ngang
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nút túi (ô vuông bo góc, mờ)
  bagAction: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tên + giá đè trên ảnh
  productCaption: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productCaptionName: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  productCaptionPrice: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Mô tả trên thẻ rộng
  wideDescriptionText: {
    position: 'absolute',
    right: 14,
    bottom: 38,
    color: '#1F1F1F',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },

  loader: {
    marginTop: 35,
  },
  emptyText: {
    textAlign: 'center',
    color: '#77716A',
    paddingVertical: 30,
  },
});