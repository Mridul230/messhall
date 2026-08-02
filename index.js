import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.student = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'MessHall API is running' });
});

// ---------- AUTH ----------

app.post('/students/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const student = await prisma.student.create({ data: { name, email, passwordHash } });
    res.status(201).json({ id: student.id, name: student.name, email: student.email });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Could not create student account' });
  }
});

app.post('/students/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await prisma.student.findUnique({ where: { email } });
    if (!student) return res.status(401).json({ error: 'Invalid email or password' });
    const isValid = await bcrypt.compare(password, student.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ studentId: student.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, student: { id: student.id, name: student.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/students/me', requireAuth, async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.student.studentId } });
  res.json({ id: student.id, name: student.name, email: student.email });
});

// ---------- BATCHES ----------

app.post('/batches', requireAuth, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    const batch = await prisma.batch.create({
      data: { date: new Date(date), startTime, endTime },
    });
    res.status(201).json(batch);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Could not create batch' });
  }
});

app.get('/batches', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({ include: { pools: true } });
    res.json(batches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not fetch batches' });
  }
});

// ---------- POOLS ----------

app.post('/pools', requireAuth, async (req, res) => {
  try {
    const { batchId, type, capacity } = req.body;
    const pool = await prisma.pool.create({
      data: { batchId, type, capacity, remainingSeats: capacity },
    });
    res.status(201).json(pool);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Could not create pool' });
  }
});

app.get('/pools', async (req, res) => {
  try {
    const pools = await prisma.pool.findMany({ include: { batch: true } });
    res.json(pools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not fetch pools' });
  }
});
app.post('/bookings', requireAuth, async (req, res) => {
  const { poolId, studentIds } = req.body; // studentIds: array of 1-4 student IDs
  const groupSize = studentIds.length;

  if (groupSize < 1 || groupSize > 4) {
    return res.status(400).json({ error: 'Group size must be between 1 and 4' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — this is the critical line
      const updateResult = await tx.pool.updateMany({
        where: {
          id: poolId,
          remainingSeats: { gte: groupSize }, // only proceeds if enough seats exist
        },
        data: {
          remainingSeats: { decrement: groupSize },
        },
      });

      if (updateResult.count === 0) {
        throw new Error('NOT_ENOUGH_SEATS');
      }

      const booking = await tx.booking.create({
        data: {
          poolId,
          groupSize,
          members: {
            create: studentIds.map((studentId) => ({ studentId })),
          },
        },
        include: { members: true },
      });

      return booking;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'NOT_ENOUGH_SEATS') {
      return res.status(409).json({ error: 'Not enough seats remaining in this pool' });
    }
    console.error(error);
    res.status(400).json({ error: 'Could not create booking' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});