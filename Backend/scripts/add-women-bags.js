const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is required.');
  process.exit(1);
}

const Product = require('../src/models/Product');

const womenBags = [
  // Everyday / Casual Bags
  {
    handbagName: 'Charles & Keith Gabine Saddle Bag',
    brand: 'Charles & Keith',
    category: 'Shoulder Bag',
    cost: 2500000,
    percentOff: 0.10,
    color: ['Black', 'Cream'],
    gender: true,
    stock: 20,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  },
  {
    handbagName: 'Charles & Keith Mini Top Handle Bag',
    brand: 'Charles & Keith',
    category: 'Handbag',
    cost: 2200000,
    percentOff: 0.05,
    color: ['White', 'Pink'],
    gender: true,
    stock: 15,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
  },
  {
    handbagName: 'Longchamp Le Pliage Original Tote',
    brand: 'Longchamp',
    category: 'Tote Bag',
    cost: 3800000,
    percentOff: 0.08,
    color: ['Black', 'Navy'],
    gender: true,
    stock: 18,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
  },
  {
    handbagName: 'Furla 1927 Mini Crossbody',
    brand: 'Furla',
    category: 'Crossbody',
    cost: 7500000,
    percentOff: 0.10,
    color: ['Beige', 'Black'],
    gender: true,
    stock: 10,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800',
  },
  {
    handbagName: 'Coach Tabby Shoulder Bag',
    brand: 'Coach',
    category: 'Shoulder Bag',
    cost: 12500000,
    percentOff: 0.12,
    color: ['Black', 'Chalk'],
    gender: true,
    stock: 8,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  },

  // Tote Bags
  {
    handbagName: 'Marc Jacobs The Tote Bag',
    brand: 'Marc Jacobs',
    category: 'Tote Bag',
    cost: 9500000,
    percentOff: 0.10,
    color: ['Black', 'Beige'],
    gender: true,
    stock: 12,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
  },
  {
    handbagName: 'Michael Kors Jet Set Travel Tote',
    brand: 'Michael Kors',
    category: 'Tote Bag',
    cost: 6800000,
    percentOff: 0.15,
    color: ['Brown', 'Black'],
    gender: true,
    stock: 14,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
  },
  {
    handbagName: 'Kate Spade Knott Large Tote',
    brand: 'Kate Spade',
    category: 'Tote Bag',
    cost: 8500000,
    percentOff: 0.08,
    color: ['Cream', 'Black'],
    gender: true,
    stock: 9,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  },

  // Luxury Handbags
  {
    handbagName: 'Louis Vuitton Alma BB',
    brand: 'Louis Vuitton',
    category: 'Handbag',
    cost: 1050000,
    percentOff: 0,
    color: ['Brown', 'Black'],
    gender: true,
    stock: 4,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  },
  {
    handbagName: 'Gucci Marmont Small Shoulder Bag',
    brand: 'Gucci',
    category: 'Shoulder Bag',
    cost: 950000,
    percentOff: 0.05,
    color: ['Black', 'Beige'],
    gender: true,
    stock: 3,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800',
  },
  {
    handbagName: 'Prada Re-Edition Shoulder Bag',
    brand: 'Prada',
    category: 'Shoulder Bag',
    cost: 880000,
    percentOff: 0,
    color: ['Black', 'White'],
    gender: true,
    stock: 5,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  },
  {
    handbagName: 'Saint Laurent Le 5 à 7 Hobo Bag',
    brand: 'Saint Laurent',
    category: 'Hobo Bag',
    cost: 1200000,
    percentOff: 0.03,
    color: ['Black', 'Tan'],
    gender: true,
    stock: 3,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800',
  },

  // Office / Work Bags
  {
    handbagName: 'Tory Burch Perry Triple Compartment Tote',
    brand: 'Tory Burch',
    category: 'Tote Bag',
    cost: 11500000,
    percentOff: 0.10,
    color: ['Black', 'Taupe'],
    gender: true,
    stock: 10,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
  },
  {
    handbagName: 'Longchamp Le Pliage City Shoulder Bag',
    brand: 'Longchamp',
    category: 'Shoulder Bag',
    cost: 4500000,
    percentOff: 0.05,
    color: ['Black', 'Khaki'],
    gender: true,
    stock: 16,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
  },
  {
    handbagName: 'Coccinelle Arlettis Leather Bag',
    brand: 'Coccinelle',
    category: 'Crossbody',
    cost: 8800000,
    percentOff: 0.08,
    color: ['Black', 'Caramel'],
    gender: true,
    stock: 7,
    status: 'published',
    uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
  },
];

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    let added = 0;

    for (const bag of womenBags) {
      const slug = bag.handbagName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      await Product.updateOne(
        { handbagName: bag.handbagName },
        { $set: { ...bag, slug } },
        { upsert: true }
      );

      added++;
      console.log(`Women's bag upserted: ${bag.handbagName} - ${bag.cost} million VND`);
    }

    const womenCount = await Product.countDocuments({ gender: true });

    console.log(`\nDone! Processed ${added} women's bags.`);
    console.log(`Total women's bags in DB: ${womenCount}`);
  } catch (error) {
    console.error('Error seeding women bags:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();