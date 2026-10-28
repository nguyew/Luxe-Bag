const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const Product = require('../models/Product');

async function releaseOrderResources(order) {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, inventoryReleased: { $ne: true } },
    { $set: { inventoryReleased: true } },
    { new: true }
  );
  if (!claimed) return false;

  const productOperations = claimed.items.map((item) => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { stock: item.qty } },
    },
  }));
  if (productOperations.length) await Product.bulkWrite(productOperations);

  if (claimed.couponCode) {
    await Coupon.updateOne(
      { code: claimed.couponCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  }
  return true;
}

module.exports = { releaseOrderResources };
