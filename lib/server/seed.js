const mongoose = require('mongoose');
// Next.js keeps local config in .env.local; load it (preferred) then .env.
require('dotenv').config({ path: ['.env.local', '.env'] });

const User = require('./models/User');
const Expo = require('./models/Expo');
const Booth = require('./models/Booth');
const Session = require('./models/Session');
const Sponsor = require('./models/Sponsor');
const ExhibitorApplication = require('./models/ExhibitorApplication');
const Attendance = require('./models/Attendance');
const Registration = require('./models/Registration');
const Review = require('./models/Review');
const { signToken } = require('./utils/qrToken');

// ── helpers ──
const day = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * day);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const at = (date, hour, min = 0) => { const d = new Date(date); d.setHours(hour, min, 0, 0); return d; };

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB...');

  // ── 1. Users ──
  const baseUsers = [
    { name: 'Admin User',     email: 'admin@eventsphere.com',     password: 'admin123', role: 'admin' },
    { name: 'Test Organizer', email: 'organizer@eventsphere.com', password: 'pass123',  role: 'organizer', company: 'EventCo' },
    { name: 'Test Exhibitor', email: 'exhibitor@eventsphere.com', password: 'pass123',  role: 'exhibitor', company: 'TechCorp' },
    { name: 'Test Attendee',  email: 'attendee@eventsphere.com',  password: 'pass123',  role: 'attendee' },
  ];

  const extraExhibitors = [
    { name: 'Dana Wu',   email: 'exhibitor1@eventsphere.com', password: 'pass123', role: 'exhibitor', company: 'NeuralBytes' },
    { name: 'Raj Patel', email: 'exhibitor2@eventsphere.com', password: 'pass123', role: 'exhibitor', company: 'CloudForge' },
    { name: 'Mia Lopez', email: 'exhibitor3@eventsphere.com', password: 'pass123', role: 'exhibitor', company: 'PixelWorks' },
  ];

  const attendeeNames = ['Alex Kim', 'Priya Rao', 'Marcus Bell', 'Sara Cohen', 'Diego Ruiz', 'Liu Yang', 'Aisha Malik', 'Tom Klein', 'Jin Seo', 'Nora Frank', 'Omar Said', 'Eva Novak'];
  const extraAttendees = attendeeNames.map((name, i) => ({
    name, email: `attendee${i + 1}@eventsphere.com`, password: 'pass123', role: 'attendee', company: pick(['—', 'Acme', 'Globex', 'Initech', 'Umbrella']),
  }));

  const allUsers = [...baseUsers, ...extraExhibitors, ...extraAttendees];
  const allEmails = allUsers.map(u => u.email);

  // ── Wipe (idempotent). NOTE: this resets ALL demo content collections. ──
  await Promise.all([
    User.deleteMany({ email: { $in: allEmails } }),
    Expo.deleteMany({}), Booth.deleteMany({}), Session.deleteMany({}),
    Sponsor.deleteMany({}), ExhibitorApplication.deleteMany({}),
    Attendance.deleteMany({}), Review.deleteMany({}),
    Registration.deleteMany({}),
  ]);

  const created = {};
  for (const u of allUsers) {
    const doc = await User.create({ ...u, isEmailVerified: true });
    created[u.email] = doc;
  }
  const organizer = created['organizer@eventsphere.com'];
  const exhibitorUsers = [created['exhibitor@eventsphere.com'], ...extraExhibitors.map(e => created[e.email])];
  const attendeeUsers = [created['attendee@eventsphere.com'], ...extraAttendees.map(a => created[a.email])];

  // ── 2. Expos (owned by the organizer) ──
  const expoDefs = [
    {
      title: 'TechExpo 2026', theme: 'The Future, Assembled', category: 'Technology',
      description: 'The flagship technology expo — hardware, software, robotics and everything in between. Three halls, 200+ exhibitors.',
      status: 'published', start: daysFromNow(21), end: daysFromNow(23), entryFee: 0, maxAttendees: 5000,
      venue: 'Metro Convention Center', city: 'San Francisco', country: 'USA', tags: ['tech', 'ai', 'hardware'], booths: 18,
    },
    {
      title: 'Future of AI Summit', theme: 'Intelligence at Scale', category: 'Artificial Intelligence',
      description: 'A focused summit on applied AI — LLMs, agents, robotics, and responsible deployment. Talks, demos and live labs.',
      status: 'ongoing', start: daysFromNow(-1), end: daysFromNow(1), entryFee: 50, maxAttendees: 1200,
      venue: 'Innovation Dome', city: 'Austin', country: 'USA', tags: ['ai', 'ml', 'research'], booths: 14,
    },
    {
      title: 'GreenBuild Conference', theme: 'Building a Sustainable Tomorrow', category: 'Sustainability',
      description: 'The premier sustainable construction and clean-energy expo. Completed edition — recap, recordings and lead reports available.',
      status: 'completed', start: daysFromNow(-12), end: daysFromNow(-10), entryFee: 25, maxAttendees: 2000,
      venue: 'Harbour Exhibition Hall', city: 'Seattle', country: 'USA', tags: ['green', 'energy', 'construction'], booths: 12,
    },
  ];

  const speakers = [
    { name: 'Dr. Lena Park', company: 'DeepMind', bio: 'Research lead in multi-agent systems.' },
    { name: 'Carlos Vega', company: 'Stripe', bio: 'Engineering director, payments infrastructure.' },
    { name: 'Hannah Lee', company: 'Figma', bio: 'Head of design systems.' },
    { name: 'Sven Olsen', company: 'Tesla', bio: 'Principal engineer, energy.' },
  ];
  const sponsorTiers = ['platinum', 'gold', 'gold', 'silver', 'bronze', 'startup'];
  const sponsorNames = ['Nimbus Cloud', 'Vertex Labs', 'Quantum Forge', 'BrightSolar', 'DataPulse', 'LaunchPad'];
  const sessionTitles = ['Opening Keynote', 'Scaling AI in Production', 'Designing for Trust', 'The Road to Net Zero', 'Founder Fireside', 'Live Demo Lab'];
  const categories = ['Keynote', 'Workshop', 'Panel', 'Demo'];

  let totalCheckins = 0;
  for (const def of expoDefs) {
    const expo = await Expo.create({
      title: def.title, description: def.description, theme: def.theme, category: def.category,
      startDate: def.start, endDate: def.end, status: def.status,
      entryFee: def.entryFee, maxAttendees: def.maxAttendees, totalBooths: def.booths,
      registrationDeadline: daysFromNow(def.status === 'completed' ? -13 : 14),
      isPublic: true, organizer: organizer._id, tags: def.tags,
      location: { venue: def.venue, city: def.city, country: def.country, address: '123 Expo Way' },
    });

    // Booths
    const boothDocs = [];
    for (let i = 1; i <= def.booths; i++) {
      boothDocs.push({
        expo: expo._id,
        boothNumber: `B${String(i).padStart(3, '0')}`,
        size: i <= 3 ? 'large' : i <= 9 ? 'medium' : 'small',
        price: i <= 3 ? 3000 : i <= 9 ? 1500 : 800,
      });
    }
    const booths = await Booth.insertMany(boothDocs);

    // Exhibitor applications — 2 approved (assigned a booth), 1 pending
    for (let k = 0; k < 3; k++) {
      const exUser = exhibitorUsers[k % exhibitorUsers.length];
      const approved = k < 2;
      const booth = booths[k];
      if (approved) {
        booth.exhibitor = exUser._id;
        booth.status = 'occupied';
        booth.description = `${exUser.company} — showcasing this year.`;
        await booth.save();
      }
      await ExhibitorApplication.create({
        expo: expo._id, user: exUser._id, companyName: exUser.company,
        companyDescription: `${exUser.company} builds great products.`,
        category: def.category, boothPreference: 'medium',
        status: approved ? 'approved' : 'pending',
        assignedBooth: approved ? booth._id : undefined,
      });
    }

    // Sessions (spread across the expo dates) with speakers + some registrations
    const sessionCount = 4;
    for (let s = 0; s < sessionCount; s++) {
      const startHour = 9 + s * 2;
      const start = at(def.start, startHour);
      const end = at(def.start, startHour + 1);
      const regs = attendeeUsers.slice(0, rand(2, attendeeUsers.length)).map(u => u._id);
      await Session.create({
        expo: expo._id, title: sessionTitles[s % sessionTitles.length],
        description: 'An insightful session with live Q&A.',
        speaker: pick(speakers), startTime: start, endTime: end,
        location: pick(['Hall A', 'Hall B', 'Main Stage', 'Lab 1']),
        category: categories[s % categories.length], maxAttendees: 200,
        registeredAttendees: regs, status: def.status === 'completed' ? 'completed' : 'scheduled',
      });
    }

    // Sponsors
    for (let sp = 0; sp < 4; sp++) {
      await Sponsor.create({
        expo: expo._id, name: sponsorNames[(sp + expoDefs.indexOf(def)) % sponsorNames.length],
        tier: sponsorTiers[sp % sponsorTiers.length],
        website: 'https://example.com', description: 'Proud partner of this event.',
        contactPerson: 'Partnerships Team', contactEmail: 'sponsor@example.com', order: sp,
      });
    }

    // Registrations + check-ins. Attendees register for any non-draft expo;
    // for ongoing/completed expos a subset is then checked in (Attendance kept
    // for analytics, Registration carries the check-in status for the new page).
    if (def.status !== 'draft') {
      const attendingCount = def.status === 'published' ? 0 : rand(6, attendeeUsers.length);
      const attending = [];
      for (let i = 0; i < attendeeUsers.length; i++) {
        const u = attendeeUsers[i];
        const reg = await Registration.create({ user: u._id, expo: expo._id });
        reg.qrToken = signToken({ rid: reg._id, uid: u._id, eid: expo._id });

        if (i < attendingCount) {
          const when = at(daysFromNow(-rand(0, 13)), rand(9, 17), rand(0, 59));
          reg.checkInStatus = true;
          reg.checkInTime = when;
          reg.scannedBy = organizer._id;
          attending.push(u);
          const att = await Attendance.create({ user: u._id, expo: expo._id, scannedBy: organizer._id, ticketIssuedAt: when });
          // Force historical createdAt so the "last 14 days" / peak-hour charts populate.
          await Attendance.updateOne({ _id: att._id }, { $set: { createdAt: when } }, { timestamps: false });
          totalCheckins++;
        }
        await reg.save();
      }

      // A couple of reviews on the completed expo
      if (def.status === 'completed') {
        for (let r = 0; r < 3; r++) {
          const u = attending[r];
          if (!u) continue;
          await Review.create({ user: u._id, expo: expo._id, rating: rand(4, 5), title: 'Great event', comment: 'Well organized and insightful.' });
        }
      }
    }
  }

  console.log('✅ Demo data seeded:');
  console.log(`   Users:        ${allUsers.length} (1 admin, 1 organizer, ${exhibitorUsers.length} exhibitors, ${attendeeUsers.length} attendees)`);
  console.log(`   Expos:        ${expoDefs.length} (published / ongoing / completed) — all owned by organizer@eventsphere.com`);
  console.log(`   + booths, sessions, sponsors, exhibitor applications, ${totalCheckins} check-ins, reviews`);
  console.log('\n   Login: organizer@eventsphere.com / pass123  (to see a populated dashboard)');
  console.log('          admin@eventsphere.com / admin123');
  process.exit();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
