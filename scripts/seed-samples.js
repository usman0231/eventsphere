/**
 * Additive sample data seeder — SAFE for the live database.
 *
 * Unlike `lib/server/seed.js` (which WIPES collections), this script only adds
 * a small, self-contained set of demo content and is idempotent: re-running it
 * removes and recreates only the three sample expos it owns (matched by title),
 * never touching any of your other data.
 *
 * It creates:
 *   - 3 approved/published expos (Technology, Health, Business)
 *   - 2 exhibitor applications per expo (one approved + booth, one pending)
 *   - 4 sessions per expo (with speakers)
 *   - Booths for each expo
 * using your existing seed accounts (organizer@ / exhibitor@ / admin@).
 *
 * Run:  node scripts/seed-samples.js     (or)  npm run seed:samples
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: ['.env.local', '.env'] });

// Models live under lib/server/models
const base = path.join(__dirname, '..', 'lib', 'server');
const User = require(path.join(base, 'models', 'User'));
const Expo = require(path.join(base, 'models', 'Expo'));
const Booth = require(path.join(base, 'models', 'Booth'));
const Session = require(path.join(base, 'models', 'Session'));
const ExhibitorApplication = require(path.join(base, 'models', 'ExhibitorApplication'));

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * day);
const at = (date, hour, min = 0) => { const d = new Date(date); d.setHours(hour, min, 0, 0); return d; };

// Sample expos — keyed by title so re-runs are idempotent.
const EXPOS = [
  {
    title: 'TechSphere Expo 2026', category: 'Technology', theme: 'Innovate. Integrate. Inspire.',
    description: 'A flagship technology exhibition featuring AI, robotics, cloud, and cybersecurity from 150+ companies.',
    venue: 'Metro Convention Center', city: 'San Francisco', country: 'USA',
    start: daysFromNow(20), end: daysFromNow(22), entryFee: 50, maxAttendees: 4000,
    tags: ['tech', 'ai', 'cloud'], booths: 16,
  },
  {
    title: 'HealthCare Innovations 2026', category: 'Health', theme: 'Caring Through Technology',
    description: 'The leading healthcare and medical-technology expo — devices, telemedicine, biotech and wellness.',
    venue: 'Grand Medical Hall', city: 'Boston', country: 'USA',
    start: daysFromNow(35), end: daysFromNow(37), entryFee: 30, maxAttendees: 2500,
    tags: ['health', 'medtech', 'biotech'], booths: 14,
  },
  {
    title: 'Global Business Summit 2026', category: 'Business', theme: 'Scaling the Future of Enterprise',
    description: 'A premier business and entrepreneurship summit — startups, fintech, marketing and leadership.',
    venue: 'Skyline Business Tower', city: 'New York', country: 'USA',
    start: daysFromNow(50), end: daysFromNow(52), entryFee: 75, maxAttendees: 3000,
    tags: ['business', 'startups', 'fintech'], booths: 12,
    pending: true, // left awaiting admin approval so the Approve Expos queue isn't empty
  },
];

const SPEAKERS = [
  { name: 'Dr. Lena Park', company: 'DeepMind', bio: 'Research lead in applied AI.' },
  { name: 'Carlos Vega', company: 'Stripe', bio: 'Engineering director, payments.' },
  { name: 'Hannah Lee', company: 'Mayo Clinic', bio: 'Head of digital health.' },
  { name: 'Sven Olsen', company: 'McKinsey', bio: 'Partner, enterprise strategy.' },
];
const SESSION_TITLES = ['Opening Keynote', 'Industry Deep-Dive', 'Expert Panel', 'Live Demo Lab'];
const SESSION_CATS = ['Keynote', 'Workshop', 'Panel', 'Demo'];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set in .env.local'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB (additive sample seed)…\n');

  // ── Resolve existing seed accounts (find-or-create so the script is robust) ──
  const ensureUser = async (email, fields) => {
    let u = await User.findOne({ email });
    if (!u) { u = await User.create({ email, isEmailVerified: true, ...fields }); console.log(`  + created missing user ${email}`); }
    return u;
  };
  const admin = await ensureUser('admin@eventsphere.com', { name: 'Admin User', password: 'admin123', role: 'admin' });
  const organizer = await ensureUser('organizer@eventsphere.com', { name: 'Test Organizer', password: 'pass123', role: 'organizer', company: 'EventCo' });
  const exhibitorA = await ensureUser('exhibitor@eventsphere.com', { name: 'Test Exhibitor', password: 'pass123', role: 'exhibitor', company: 'TechCorp' });
  const exhibitorB = await ensureUser('exhibitor1@eventsphere.com', { name: 'Dana Wu', password: 'pass123', role: 'exhibitor', company: 'NeuralBytes' });

  for (const def of EXPOS) {
    // Idempotent: remove a previous run of THIS sample expo (and its children) only.
    const existing = await Expo.findOne({ title: def.title });
    if (existing) {
      await Promise.all([
        Booth.deleteMany({ expo: existing._id }),
        Session.deleteMany({ expo: existing._id }),
        ExhibitorApplication.deleteMany({ expo: existing._id }),
      ]);
      await existing.deleteOne();
      console.log(`  ↻ replaced existing "${def.title}"`);
    }

    const pending = !!def.pending;
    const expo = await Expo.create({
      title: def.title, description: def.description, theme: def.theme, category: def.category,
      startDate: def.start, endDate: def.end,
      // Most samples are approved & live; one is left pending to populate the
      // admin "Approve Expos" queue for the demo.
      status: pending ? 'draft' : 'published',
      approvalStatus: pending ? 'pending' : 'approved',
      approvedBy: pending ? undefined : admin._id,
      approvedAt: pending ? undefined : new Date(),
      entryFee: def.entryFee, maxAttendees: def.maxAttendees, totalBooths: def.booths,
      registrationDeadline: daysFromNow(14), isPublic: true, organizer: organizer._id, tags: def.tags,
      location: { venue: def.venue, city: def.city, country: def.country, address: '1 Exhibition Avenue' },
    });

    // Booths
    const boothDocs = [];
    for (let i = 1; i <= def.booths; i++) {
      boothDocs.push({
        expo: expo._id, boothNumber: `B${String(i).padStart(3, '0')}`,
        size: i <= 3 ? 'large' : i <= 8 ? 'medium' : 'small',
        price: i <= 3 ? 3000 : i <= 8 ? 1500 : 800,
      });
    }
    const booths = await Booth.insertMany(boothDocs);

    // 2 exhibitor applications: #1 approved (gets booth), #2 pending
    const applicants = [
      { user: exhibitorA, approved: true },
      { user: exhibitorB, approved: false },
    ];
    for (let k = 0; k < applicants.length; k++) {
      const { user, approved } = applicants[k];
      let assignedBooth;
      if (approved) {
        const booth = booths[k];
        booth.exhibitor = user._id;
        booth.status = 'occupied';
        booth.description = `${user.company} — showcasing at ${def.title}.`;
        await booth.save();
        assignedBooth = booth._id;
      }
      await ExhibitorApplication.create({
        expo: expo._id, user: user._id, companyName: user.company,
        companyDescription: `${user.company} builds great products for the ${def.category.toLowerCase()} industry.`,
        category: def.category, boothPreference: 'medium',
        status: approved ? 'approved' : 'pending',
        products: ['Flagship Product', 'Enterprise Plan'],
        assignedBooth,
      });
    }

    // 4 sessions across day one, with speakers
    for (let s = 0; s < SESSION_TITLES.length; s++) {
      const startHour = 9 + s * 2;
      await Session.create({
        expo: expo._id, title: SESSION_TITLES[s],
        description: 'An insightful session with live Q&A.',
        speaker: SPEAKERS[s % SPEAKERS.length],
        startTime: at(def.start, startHour), endTime: at(def.start, startHour + 1),
        location: ['Hall A', 'Hall B', 'Main Stage', 'Lab 1'][s % 4],
        category: SESSION_CATS[s % SESSION_CATS.length], maxAttendees: 200, status: 'scheduled',
      });
    }

    console.log(`  ${pending ? '⏳' : '✅'} ${def.title}  (${def.category})${pending ? ' [PENDING APPROVAL]' : ''} — ${def.booths} booths, 2 applications, 4 sessions`);
  }

  console.log('\nDone. 3 sample expos added (owned by organizer@eventsphere.com).');
  console.log('Log in as organizer@eventsphere.com / pass123 to see a populated dashboard,');
  console.log('and as exhibitor@eventsphere.com / pass123 to see approved applications.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
