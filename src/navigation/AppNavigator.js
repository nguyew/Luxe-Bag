import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import DetailScreen from '../screens/DetailScreen';
import FavoritesScreen from '../screens/FavouritesScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import StylistScreen from '../screens/StylistScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminTabs from './AdminTabs';
import AdminProductFormScreen from '../screens/AdminProductFormScreen';
import AdminOrderDetailScreen from '../screens/AdminOrderDetailScreen';
import AdminCustomerDetailScreen from '../screens/AdminCustomerDetailScreen';
import AdminReviewsScreen from '../screens/AdminReviewsScreen';
import AdminPromotionsScreen from '../screens/AdminPromotionsScreen';
import AdminCouponFormScreen from '../screens/AdminCouponFormScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import AdminTaxonomyScreen from '../screens/AdminTaxonomyScreen';
import ReviewFormScreen from '../screens/ReviewFormScreen';
import ReturnRequestScreen from '../screens/ReturnRequestScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import AddressesScreen from '../screens/AddressesScreen';
import AddressFormScreen from '../screens/AddressFormScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import { getSnapshot as getCartSnapshot, subscribe as subscribeCart } from '../services/cartService';
import useAuth from '../hooks/useAuth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 4 tab theo ảnh mẫu: home, heart, bag, user
const TAB_ICONS = {
  Home: 'home-outline',
  Favorites: 'heart-outline',
  Cart: 'bag-handle-outline',
  Profile: 'person-outline',
};

// Kích thước gọn của thanh tab
const BAR_WIDTH = 248;
const BAR_HEIGHT = 52;
const CIRCLE = 38;

/**
 * Một tab: vòng tròn trắng luôn được vẽ sẵn (bo tròn cố định) và chỉ
 * đổi độ mờ + phóng to/thu nhỏ khi chọn, nên luôn tròn và chuyển mượt.
 */
function TabItem({ name, focused, badge, onPress, onLongPress }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  const circleScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const darkOpacity = progress;
  const lightOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${name}, ${badge} items` : name}
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <View style={styles.circleSlot}>
        <Animated.View
          style={[
            styles.circle,
            { opacity: progress, transform: [{ scale: circleScale }] },
          ]}
        />
        <Animated.View style={[styles.iconLayer, { opacity: lightOpacity }]}>
          <Ionicons name={TAB_ICONS[name]} size={19} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, { opacity: darkOpacity }]}>
          <Ionicons name={TAB_ICONS[name]} size={19} color="#1E1E1E" />
        </Animated.View>
        {badge > 0 && (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Thanh tab tự vẽ: viên thuốc đen nhỏ, căn giữa, nổi phía trên
 * thanh điều hướng của hệ thống.
 */
function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  // Số món trong giỏ -> huy hiệu trên tab Cart (đọc thẳng từ kho giỏ hàng, nhẹ)
  const cart = useSyncExternalStore(subscribeCart, getCartSnapshot, getCartSnapshot);
  const cartCount = cart.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + 14 }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              name={route.name}
              focused={focused}
              badge={route.name === 'Cart' ? cartCount : 0}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      // freezeOnBlur: tab đang ẩn không vẽ lại khi dữ liệu đổi -> chuyển tab nhẹ hơn
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const detailHeader = {
  headerTintColor: '#1A1A1A',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#F3F1F1' },
};

/**
 * Điều hướng theo trạng thái đăng nhập (cách React Navigation khuyến nghị:
 * chỉ khai báo những màn hình mà người dùng hiện tại được phép vào).
 *  - Khách / khách hàng: tabs + Search + Stylist + Detail (khách duyệt hàng tự do).
 *  - Admin: chỉ có khu quản trị (4 tab + form sản phẩm, chi tiết đơn, chi tiết khách).
 *  - Khách chưa đăng nhập: thêm Login / Register (dạng modal).
 * Đăng nhập xong màn Login tự biến mất và giao diện đổi theo role.
 */
export default function AppNavigator() {
  const { loading, isLoggedIn, isAdmin } = useAuth();

  // Đang đọc phiên đã lưu (vài mili-giây) -> chưa vẽ gì để khỏi nháy sai giao diện
  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#292725" />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {isAdmin ? (
        <>
          <Stack.Screen
            name="AdminTabs"
            component={AdminTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AdminProductForm"
            component={AdminProductFormScreen}
            options={({ route }) => ({
              title: route.params?.handbagId ? 'Edit Product' : 'New Product',
              ...detailHeader,
            })}
          />
          <Stack.Screen
            name="AdminOrderDetail"
            component={AdminOrderDetailScreen}
            options={{ title: 'Order', ...detailHeader }}
          />
          <Stack.Screen
            name="AdminCustomerDetail"
            component={AdminCustomerDetailScreen}
            options={{ title: 'Customer', ...detailHeader }}
          />
          <Stack.Screen
            name="AdminReviews"
            component={AdminReviewsScreen}
            options={{ title: 'Review Moderation', ...detailHeader }}
          />
          <Stack.Screen
            name="AdminPromotions"
            component={AdminPromotionsScreen}
            options={{ title: 'Discount Codes', ...detailHeader }}
          />
          <Stack.Screen
            name="AdminCouponForm"
            component={AdminCouponFormScreen}
            options={({ route }) => ({
              title: route.params?.couponId ? 'Edit Code' : 'New Code',
              ...detailHeader,
            })}
          />
          <Stack.Screen
            name="AdminReports"
            component={AdminReportsScreen}
            options={{ title: 'Sales Report', ...detailHeader }}
          />
          <Stack.Screen
            name="AdminTaxonomy"
            component={AdminTaxonomyScreen}
            options={{ title: 'Brands & Categories', ...detailHeader }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: 'Search', ...detailHeader }}
          />
          <Stack.Screen
            name="Stylist"
            component={StylistScreen}
            options={{ title: 'AI Stylist', ...detailHeader }}
          />
          <Stack.Screen
            name="Detail"
            component={DetailScreen}
            options={{ title: 'Handbag Details', ...detailHeader }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: 'Checkout', ...detailHeader }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ title: 'My Orders', ...detailHeader }}
          />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: 'Order Details', ...detailHeader }}
          />
          <Stack.Screen
            name="ReviewForm"
            component={ReviewFormScreen}
            options={{ title: 'Your Review', ...detailHeader }}
          />
          <Stack.Screen
            name="ReturnRequest"
            component={ReturnRequestScreen}
            options={{ title: 'Return Request', ...detailHeader }}
          />
          <Stack.Screen
            name="Addresses"
            component={AddressesScreen}
            options={{ title: 'Delivery Addresses', ...detailHeader }}
          />
          <Stack.Screen
            name="AddressForm"
            component={AddressFormScreen}
            options={({ route }) => ({
              title: route.params?.addressId ? 'Edit Address' : 'New Address',
              ...detailHeader,
            })}
          />
        </>
      )}

      {!isLoggedIn && (
        <Stack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#FF4D5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F1F1',
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 7,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSlot: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE,
    backgroundColor: '#FFFFFF',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});