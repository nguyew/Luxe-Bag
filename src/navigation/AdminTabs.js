import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import AdminCustomersScreen from '../screens/AdminCustomersScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  AdminDashboard: ['grid', 'grid-outline'],
  AdminProducts: ['pricetags', 'pricetags-outline'],
  AdminOrders: ['receipt', 'receipt-outline'],
  AdminCustomers: ['people', 'people-outline'],
};

/** 4 tab của khu quản trị: Dashboard, Products, Orders, Customers. */
export default function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: true,
        tabBarActiveTintColor: '#050505',
        tabBarInactiveTintColor: '#9A948D',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E4DFDA' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="AdminDashboard" component={AdminHomeScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="AdminProducts" component={AdminProductsScreen} options={{ title: 'Products' }} />
      <Tab.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <Tab.Screen name="AdminCustomers" component={AdminCustomersScreen} options={{ title: 'Customers' }} />
    </Tab.Navigator>
  );
}
