const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { createClient } = require('redis');
const wrtc = require('wrtc');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const redisClient = createClient();

redisClient.connect();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('choose_interest', async (interest) => {
    await matchOrRedirect(socket, interest);
  });

  async function matchOrRedirect(socket, interest) {
    const waitingUsers = await redisClient.lrange(interest, 0, -1);
    if (waitingUsers.length > 0) {
      const matchedUser = waitingUsers.shift();
      io.to(socket.id).emit('matched', matchedUser);
      io.to(matchedUser).emit('matched', socket.id);
    } else {
      await redisClient.rpush(interest, socket.id);

      setTimeout(async () => {
        const currentList = await redisClient.lrange(interest, 0, -1);
        if (currentList.includes(socket.id)) {
          await redisClient.lrem(interest, 0, socket.id);
          const fallbackInterest = getFallbackInterest(interest);
          socket.emit('redirect_interest', fallbackInterest);
          await matchOrRedirect(socket, fallbackInterest);
        }
      }, 10000);
    }fl
  }

  function getFallbackInterest(currentInterest) {
    if (currentInterest === 'Amour') return 'Business';
    if (currentInterest === 'Business') return 'Divertissement';
    return 'Amour';
  }

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    Object.keys(waitingUsers).forEach(async (interest) => {
      await redisClient.lrem(interest, 0, socket.id);
    });
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
