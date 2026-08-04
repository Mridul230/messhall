import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to server, listening for poolUpdated events...');
});

socket.on('poolUpdated', (data) => {
  console.log('Received poolUpdated event:', data);
});