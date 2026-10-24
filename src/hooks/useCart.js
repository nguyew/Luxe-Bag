import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  cartAdd,
  cartClear,
  cartRemove,
  cartReplace,
  cartSetQty,
  getSnapshot,
  subscribe,
} from '../services/cartService';
import useHandbags from './useHandbags';
import {
  MAX_PER_LINE,
  isPublished,
  maxQtyFor,
  unitPrice,
} from '../utils/catalog';
import { calcTotals } from '../utils/orders';

/**
 * Giỏ hàng cho giao diện: ghép { id, qty } với dữ liệu túi mới nhất.
 *
 * lines[]: { id, qty, product, unitPrice, lineTotal, maxQty, problem }
 *   problem: null | 'unavailable' (hết hàng/đã gỡ) | 'limited' (số lượng vượt tồn kho)
 * Giá tiền (subtotal/shipping/total) chỉ tính các dòng không có vấn đề.
 */
export default function useCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { allItems } = useHandbags();

  const lines = useMemo(() => {
    const catalogReady = allItems.length > 0;
    const byId = new Map(allItems.map((item) => [String(item.id), item]));

    return cart.items.map(({ id, qty }) => {
      const product = byId.get(id) || null;
      const maxQty = product ? maxQtyFor(product) : 0;

      let problem = null;
      if (catalogReady) {
        if (!product || !isPublished(product) || maxQty === 0) problem = 'unavailable';
        else if (qty > maxQty) problem = 'limited';
      }

      const price = product ? unitPrice(product) : 0;
      return { id, qty, product, unitPrice: price, lineTotal: price * qty, maxQty, problem };
    });
  }, [cart.items, allItems]);

  const totals = useMemo(
    () => calcTotals(lines.filter((line) => !line.problem)),
    [lines]
  );
  const count = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty, 0),
    [lines]
  );
  const hasProblem = lines.some((line) => line.problem);

  /** Thêm vào giỏ. Trả về { ok, reason? } với reason: 'out_of_stock' | 'limit'. */
  const add = useCallback(
    (handbag, qty = 1) => {
      const max = maxQtyFor(handbag);
      if (!isPublished(handbag) || max === 0) return { ok: false, reason: 'out_of_stock' };

      const current = getSnapshot().items.find((item) => item.id === String(handbag.id));
      if (current && current.qty >= max) return { ok: false, reason: 'limit', max };

      cartAdd(handbag.id, qty, max);
      return { ok: true };
    },
    []
  );

  /** Bỏ các món hết hàng và hạ số lượng về mức còn lại. */
  const fixProblems = useCallback(() => {
    cartReplace(
      lines
        .filter((line) => line.problem !== 'unavailable')
        .map((line) => ({ id: line.id, qty: Math.min(line.qty, line.maxQty || MAX_PER_LINE) }))
    );
  }, [lines]);

  return {
    ready: cart.ready,
    lines,
    count,
    hasProblem,
    ...totals,
    add,
    setQty: cartSetQty,
    remove: cartRemove,
    clear: cartClear,
    fixProblems,
  };
}

