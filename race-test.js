import axios from 'axios';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOjEsImlhdCI6MTc4NTY3NzgzNiwiZXhwIjoxNzg1NzY0MjM2fQ.nxaLrx2KVxA2k61WPJSZY7ATLxo6bqVoZsxSud6g8Wc';
const POOL_ID = 1; // update this to your fresh test pool's id

async function attemptBooking(studentId) {
  try {
    const res = await axios.post(
      'http://localhost:3001/bookings',
      { poolId: 3, studentIds: [studentId] },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    console.log(`Student ${studentId}: SUCCESS (booking id ${res.data.id})`);
  } catch (err) {
    console.log(`Student ${studentId}: FAILED (${err.response?.data?.error})`);
  }
}


async function runTest() {
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => attemptBooking(id)));
}

runTest();