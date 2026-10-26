import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import * as RN from 'react-native';
import * as navMod from '@react-navigation/native';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Bỏ cảnh báo console.error về act() của renderer; vẫn in lỗi thật
const origError = console.error;
console.error = (...a) => { const m = String(a[0]); if (m.includes('react-test-renderer is deprecated') || m.includes('not wrapped in act')) return; origError(...a); };

export const alerts = RN.__alerts;

export function makeNav() {
  const calls = [];
  const rec = (type) => (...args) => { calls.push({ type, args }); };
  return { calls, navigate: rec('navigate'), replace: rec('replace'), goBack: rec('goBack'), setOptions() {}, addListener: () => () => {}, push: rec('push'), popToTop: rec('popToTop') };
}

export const settle = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

export async function mount(element) {
  let r;
  await act(async () => { r = TestRenderer.create(element); });
  await settle();
  return r;
}

const flat = (c) => (Array.isArray(c) ? c.map(flat).join('') : c === null || c === undefined || typeof c === 'boolean' ? '' : String(c));
export const textOf = (node) => node.findAll((n) => n.type === 'Text').map((t) => flat(t.props.children)).join(' ');
export const allText = (r) => r.root.findAll((n) => n.type === 'Text').map((t) => flat(t.props.children)).join(' | ');
export const has = (r, s) => allText(r).includes(s);

function pick(r, label, index = 0) {
  const nodes = r.root.findAll((n) => n.type === 'Pressable');
  const exact = nodes.filter((n) => n.props.accessibilityLabel === label);
  const byText = nodes.filter((n) => textOf(n).includes(label) || String(n.props.accessibilityLabel || '').includes(label));
  const list = exact.length ? exact : byText;
  return index < 0 ? list[list.length + index] : list[index]; // index âm: đếm từ cuối
}
export const hasPressable = (r, label) => !!pick(r, label);
export const isDisabled = (r, label) => !!pick(r, label)?.props.disabled;

export async function press(r, label, index = 0) {
  const node = pick(r, label, index);
  if (!node) throw new Error(`No pressable "${label}". Screen text: ${allText(r).slice(0, 600)}`);
  if (node.props.disabled) return false;
  await act(async () => { await node.props.onPress?.(); });
  await settle();
  return true;
}

export async function typeInto(r, label, text) {
  const node = r.root.findAll((n) => n.type === 'TextInput' && (n.props.accessibilityLabel === label || n.props.placeholder === label))[0];
  if (!node) throw new Error(`No input "${label}"`);
  await act(async () => { node.props.onChangeText(text); });
  await settle(2);
}

export async function pressAlert(buttonText) {
  const alert = alerts[alerts.length - 1];
  if (!alert) throw new Error('No alert shown');
  const button = alert.buttons.find((b) => b.text === buttonText);
  if (!button) throw new Error(`Alert "${alert.title}" has no button "${buttonText}": ${alert.buttons.map((b) => b.text)}`);
  await act(async () => { await button.onPress?.(); });
  await settle();
}

export const lastAlert = () => alerts[alerts.length - 1];
export const useNav = (nav) => { navMod.__state.nav = nav; };
export { act };
