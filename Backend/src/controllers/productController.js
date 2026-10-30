const mongoose = require('mongoose');
const crypto = require('crypto');

const Product = require('../models/Product');
const Review = require('../models/Review');
const CatalogTerm = require('../models/CatalogTerm');

const {
  createUpload,
  deleteObject,
  uploadObject,
} = require('../services/b2Storage');

const {
  createImage,
  syncLegacyPrimary,
} = require('../utils/productImages');

const {
  buildProductFilter,
  productSort,
} = require('../utils/productQuery');

const {
  discountedProduct,
  getActivePromotions,
  selectPromotion,
} = require('../services/pricingService');

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const fields = [
  'handbagName',
  'brand',
  'category',
  'cost',
  'originalCost',
  'percentOff',
  'discountMode',
  'color',
  'gender',
  'stock',
  'status',
  'uri',
  'imageKey',
];

const validate = (body, partial = false) => {
  const errors = [];

  if (!partial || body.handbagName !== undefined) {
    if (
      typeof body.handbagName !== 'string' ||
      body.handbagName.trim().length < 2
    ) {
      errors.push(
        'handbagName must be at least 2 characters.'
      );
    }
  }

  if (!partial || body.brand !== undefined) {
    if (
      typeof body.brand !== 'string' ||
      !body.brand.trim()
    ) {
      errors.push('brand is required.');
    }
  }

  if (!partial || body.cost !== undefined) {
    if (
      !Number.isFinite(Number(body.cost)) ||
      Number(body.cost) <= 0
    ) {
      errors.push('cost must be greater than 0.');
    }
  }

  if (
    body.originalCost !== undefined &&
    (
      !Number.isFinite(Number(body.originalCost)) ||
      Number(body.originalCost) < 0
    )
  ) {
    errors.push(
      'originalCost must be a non-negative number.'
    );
  }

  if (
    body.percentOff !== undefined &&
    (
      !Number.isFinite(Number(body.percentOff)) ||
      Number(body.percentOff) < 0 ||
      Number(body.percentOff) > 0.9
    )
  ) {
    errors.push(
      'percentOff must be between 0 and 0.9.'
    );
  }

  if (
    body.discountMode !== undefined &&
    !['real', 'fake'].includes(body.discountMode)
  ) {
    errors.push(
      'discountMode must be real or fake.'
    );
  }

  if (
    body.stock !== undefined &&
    (
      !Number.isInteger(Number(body.stock)) ||
      Number(body.stock) < 0
    )
  ) {
    errors.push(
      'stock must be a non-negative integer.'
    );
  }

  if (
    body.status !== undefined &&
    !['draft', 'published', 'archived'].includes(body.status)
  ) {
    errors.push('Invalid product status.');
  }

  if (
    body.color !== undefined &&
    (
      !Array.isArray(body.color) ||
      body.color.some(
        (value) => typeof value !== 'string'
      )
    )
  ) {
    errors.push(
      'color must be an array of strings.'
    );
  }

  const hasUri = body.uri !== undefined;
  const hasImageKey = body.imageKey !== undefined;

  if (
    hasImageKey &&
    body.imageKey &&
    !body.uri
  ) {
    errors.push(
      'An image URL is required when imageKey is provided.'
    );
  }

  if (
    hasUri &&
    body.uri &&
    !/^https?:\/\/\S+$/i.test(String(body.uri))
  ) {
    errors.push(
      'uri must be a valid HTTP image URL.'
    );
  }

  return errors;
};

const pick = (body) =>
  Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]])
  );

const toSlug = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);

const createSlug = (body) => {
  const base =
    toSlug(`${body.brand}-${body.handbagName}`) ||
    'product';

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
};

const resolveCatalogValue = async (type, value) => {
  const raw = String(value || '').trim();

  if (!raw) {
    return raw;
  }

  const term = await CatalogTerm.findOne({
    type,
    $or: [
      ...(mongoose.isValidObjectId(raw)
        ? [{ _id: raw }]
        : []),
      { name: raw },
      { slug: raw },
    ],
  })
    .select('name')
    .lean();

  return term?.name || raw;
};

const ensureCatalogTerm = async (type, rawName) => {
  const name = String(rawName || '').trim();
  const slug = toSlug(name);

  if (name.length < 2 || !slug) {
    return;
  }

  try {
    await CatalogTerm.updateOne(
      { type, slug },
      {
        $setOnInsert: {
          type,
          name,
          slug,
          active: true,
          sortOrder: 0,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
  }
};

const findById = (id) =>
  mongoose.isValidObjectId(id)
    ? Product.findById(id)
    : null;

const sendNotFound = (res, id) =>
  res
    .status(
      mongoose.isValidObjectId(id) ? 404 : 400
    )
    .json({
      error: mongoose.isValidObjectId(id)
        ? 'Product not found.'
        : 'Invalid product id.',
    });

const attachFeedbacks = async (
  products,
  includeHidden = false
) => {
  if (!products.length) {
    return products;
  }

  const ids = products.map(
    (product) => product._id
  );

  const filter = {
    productId: { $in: ids },
  };

  if (!includeHidden) {
    filter.hidden = false;
  }

  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 });

  const grouped = new Map();

  for (const review of reviews) {
    const key = String(review.productId);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push({
      id: String(review._id),
      userId: String(review.userId),
      author: review.author || 'Anonymous',
      rating: Number(review.rating),
      comment: review.comment || '',
      date: new Date(
        review.createdAt
      ).toISOString(),
      hidden: review.hidden === true,
    });
  }

  return products.map((product) => ({
    ...(product.toObject
      ? product.toObject()
      : product),

    id: String(
      product._id || product.id
    ),

    feedbacks:
      grouped.get(
        String(product._id || product.id)
      ) || [],
  }));
};

const attachPromotions = async (products) => {
  const promotions = await getActivePromotions();

  return products.map((product) =>
    discountedProduct(
      product,
      selectPromotion(promotions, product)
    )
  );
};

const listProducts = async (req, res) => {
  const isAdmin = req.user?.role === 'admin';

  const page = Math.max(
    Number.parseInt(req.query.page || '1', 10),
    1
  );

  const defaultLimit = isAdmin ? 500 : 100;
  const maxLimit = isAdmin ? 500 : 100;

  const limit = Math.min(
    Math.max(
      Number.parseInt(
        req.query.limit || String(defaultLimit),
        10
      ),
      1
    ),
    maxLimit
  );

  const {
    filter,
    minPrice,
    maxPrice,
  } = buildProductFilter(
    req.query,
    isAdmin
  );

  if (
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > maxPrice
  ) {
    return res.status(400).json({
      error:
        'minPrice cannot be greater than maxPrice.',
    });
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(productSort(req.query.sort))
      .skip((page - 1) * limit)
      .limit(limit),

    Product.countDocuments(filter),
  ]);

  const withFeedbacks = await attachFeedbacks(
    products,
    isAdmin
  );

  return res.json({
    products: isAdmin
      ? withFeedbacks
      : await attachPromotions(withFeedbacks),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

const getProduct = async (req, res) => {
  const product = await (
    mongoose.isValidObjectId(req.params.id)
      ? Product.findOne(
          req.user
            ? { _id: req.params.id }
            : {
                _id: req.params.id,
                status: 'published',
              }
        )
      : null
  );

  if (!product) {
    return sendNotFound(
      res,
      req.params.id
    );
  }

  const [withFeedbacks] = await attachFeedbacks(
    [product],
    req.user?.role === 'admin'
  );

  const [result] =
    req.user?.role === 'admin'
      ? [withFeedbacks]
      : await attachPromotions([withFeedbacks]);

  return res.json({
    product: result,
  });
};

const createProduct = async (req, res) => {
  const body = req.body || {};
  const errors = validate(body);

  if (errors.length) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: errors,
    });
  }

  const productData = {
    ...pick(body),
    slug: createSlug(body),
  };

  // Các trường này không được cập nhật trực tiếp
  // khi tạo sản phẩm theo logic hiện tại.
  delete productData.originalCost;
  delete productData.percentOff;
  delete productData.discountMode;

  productData.brand = await resolveCatalogValue(
    'brand',
    productData.brand
  );

  productData.category = await resolveCatalogValue(
    'category',
    productData.category
  );

  if (productData.uri && productData.imageKey) {
    // Ảnh đã upload lên hệ thống lưu trữ.
    productData.images = [
      createImage({
        url: productData.uri,
        key: productData.imageKey,
        alt: productData.handbagName,
        isPrimary: true,
      }),
    ];
  } else if (productData.uri) {
    // Ảnh sử dụng URL bên ngoài.
    productData.images = [];
    productData.imageKey = '';
  }

  const product = await Product.create(productData);

  await Promise.all([
    ensureCatalogTerm(
      'brand',
      product.brand
    ),

    ensureCatalogTerm(
      'category',
      product.category
    ),
  ]);

  return res.status(201).json({
    product,
  });
};

const updateProduct = async (req, res) => {
  const body = req.body || {};

  const product = await findById(
    req.params.id
  );

  if (!product) {
    return sendNotFound(
      res,
      req.params.id
    );
  }

  const errors = validate(body, true);

  if (errors.length) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: errors,
    });
  }

  // Lưu lại key ảnh cũ để xóa nếu không còn sử dụng.
  const oldImageKey = product.imageKey;

  const updates = pick(body);

  // Xử lý ảnh riêng để tránh ghi đè sai dữ liệu.
  delete updates.uri;
  delete updates.imageKey;

  if (updates.brand !== undefined) {
    updates.brand = await resolveCatalogValue(
      'brand',
      updates.brand
    );
  }

  if (updates.category !== undefined) {
    updates.category = await resolveCatalogValue(
      'category',
      updates.category
    );
  }

  // Cập nhật các trường thông thường.
  Object.assign(product, updates);

  // Chỉ xử lý ảnh khi frontend gửi trường uri.
  if (body.uri !== undefined) {
    const nextUrl = String(
      body.uri || ''
    ).trim();

    const nextKey = String(
      body.imageKey || ''
    ).trim();

    // Đảm bảo images luôn là một mảng.
    product.images = Array.isArray(
      product.images
    )
      ? product.images
      : [];

    const primary =
      product.images.find(
        (image) => image.isPrimary
      ) || product.images[0];

    if (!nextUrl) {
      // Người dùng xóa ảnh.
      product.images = [];
      product.uri = '';
      product.imageKey = '';
    } else if (nextKey) {
      // Ảnh được upload lên hệ thống lưu trữ.
      if (primary) {
        primary.url = nextUrl;
        primary.key = nextKey;
        primary.alt = product.handbagName;
        primary.isPrimary = true;
      } else {
        product.images.push(
          createImage({
            url: nextUrl,
            key: nextKey,
            alt: product.handbagName,
            isPrimary: true,
          })
        );
      }

      // Đồng bộ uri và imageKey cũ với ảnh chính.
      syncLegacyPrimary(product);
    } else {
      // Ảnh sử dụng URL bên ngoài.
      product.images = [];
      product.uri = nextUrl;
      product.imageKey = '';
    }
  }

  // Bổ sung slug nếu sản phẩm chưa có.
  if (!product.slug) {
    product.slug = createSlug({
      brand: product.brand,
      handbagName: product.handbagName,
    });
  }

  // Lưu sản phẩm vào MongoDB.
  await product.save();

  // Đảm bảo brand và category có trong danh mục.
  await Promise.all([
    ensureCatalogTerm(
      'brand',
      product.brand
    ),

    ensureCatalogTerm(
      'category',
      product.category
    ),
  ]);

  const currentImages = Array.isArray(
    product.images
  )
    ? product.images
    : [];

  const stillUsed = currentImages.some(
    (image) => image.key === oldImageKey
  );

  // Chỉ xóa ảnh cũ khi sản phẩm không còn sử dụng key đó.
  if (
    oldImageKey &&
    oldImageKey !== product.imageKey &&
    !stillUsed
  ) {
    await deleteObject(oldImageKey);
  }

  // QUAN TRỌNG:
  // Trả kết quả về frontend sau khi cập nhật thành công.
  return res.json({
    product,
  });
};

const deleteProduct = async (req, res) => {
  const product = await findById(
    req.params.id
  );

  if (!product) {
    return sendNotFound(
      res,
      req.params.id
    );
  }

  const keys = [
    ...new Set([
      product.imageKey,
      ...(product.images || []).map(
        (image) => image.key
      ),
    ].filter(Boolean)),
  ];

  await Product.deleteOne({
    _id: product._id,
  });

  // Không để lỗi xóa ảnh làm hỏng kết quả xóa sản phẩm.
  await Promise.allSettled(
    keys.map((key) => deleteObject(key))
  );

  return res.status(204).send();
};

const createImageUpload = async (req, res) => {
  const {
    contentType,
  } = req.body || {};

  if (!allowedTypes.has(contentType)) {
    return res.status(400).json({
      error:
        'Only JPEG, PNG, and WebP images are allowed.',
    });
  }

  const result = await createUpload({
    contentType,
  });

  return res.json(result);
};
const uploadImageProxy = async (req, res) => {
  const contentType =
    req.headers['content-type'];

  if (!allowedTypes.has(contentType)) {
    return res.status(400).json({
      error:
        'Only JPEG, PNG, and WebP images are allowed.',
    });
  }

  if (
    !Buffer.isBuffer(req.body) ||
    req.body.length === 0
  ) {
    return res.status(400).json({
      error: 'An image body is required.',
    });
  }

  const extension = contentType.split('/')[1];

  const key = `products/${crypto.randomUUID()}.${extension}`;

  const uri = await uploadObject({
    key,
    body: req.body,
    contentType,
  });

  return res.status(201).json({
    key,
    uri,
  });
};

module.exports = {
  createImageUpload,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  uploadImageProxy,
};