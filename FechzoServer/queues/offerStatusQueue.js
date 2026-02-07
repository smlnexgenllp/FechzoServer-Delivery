const Queue = require('bull');
const Offer = require('../models/offers/Offer'); 
const AdminOffer = require('../models/offers/AdminOffer');

// Redis configuration using Redis Cloud settings
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis-15079.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
  port: process.env.REDIS_PORT || 15079,
  password: process.env.REDIS_PASSWORD, // Password is required for Redis Cloud
  // Temporarily disable TLS for debugging
  // tls: process.env.REDIS_TLS === 'true' ? {
  //   minVersion: 'TLSv1.2',
  //   maxVersion: 'TLSv1.3',
  //   servername: process.env.REDIS_HOST || 'redis-15079.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
  //   ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
  //   rejectUnauthorized: true,
  // } : undefined,
};

// Create a Bull queue
const offerStatusQueue = new Queue('offer-status-queue', {
  redis: {
    ...redisConfig,

    // 🔴 IMPORTANT FIX
    maxRetriesPerRequest: null,   // disables retry limit error
    enableReadyCheck: false,      // avoids Redis Cloud ready-check issues
    retryStrategy(times) {
      return Math.min(times * 100, 2000); // exponential backoff
    },
  },
});


// Log Redis connection events
offerStatusQueue.client.on('connect', () => {
  console.log('Redis client connected to Redis Cloud');
});

offerStatusQueue.client.on('ready', () => {
  console.log('Redis client is ready');
});

offerStatusQueue.client.on('error', (error) => {
  console.error('Redis client error:', error.message);
});

offerStatusQueue.client.on('end', () => {
  console.log('Redis client connection closed');
});

// Process jobs in the queue
// Modify the process function to handle both regular and admin offers
offerStatusQueue.process(async (job) => {
  const { offerId, newStatus, isAdminOffer } = job.data;
  
  try {
    // Choose the appropriate model based on the flag
    const OfferModel = isAdminOffer ? AdminOffer : Offer;
    
    const offer = await OfferModel.findById(offerId);
    if (!offer) {
      console.log(`Offer ${offerId} not found in ${isAdminOffer ? 'Admin' : 'Restaurant'} offers`);
      return;
    }
    
    offer.status = newStatus;
    await offer.save();
    console.log(`Updated ${isAdminOffer ? 'Admin' : 'Restaurant'} offer ${offerId} status to ${newStatus}`);

    // For socket notifications, handle differently based on offer type
    const io = require('../server').get('io');
    if (io) {
      if (isAdminOffer) {
        // Broadcast to admin channel
        io.to('admin-channel').emit('adminOfferStatusUpdate', {
          offerId: offer._id,
          status: newStatus
        });
        console.log(`Emitted adminOfferStatusUpdate for offer ${offerId}`);
      } else {
        // Original restaurant-specific notification
        io.to(offer.restaurantId.toString()).emit('offerStatusUpdate', {
          offerId: offer._id,
          status: newStatus
        });
        console.log(`Emitted offerStatusUpdate for offer ${offerId} to restaurant ${offer.restaurantId}`);
      }
    }
  } catch (error) {
    console.error(`Error updating ${isAdminOffer ? 'Admin' : 'Restaurant'} offer ${offerId} status:`, error.message);
    throw error;
  }
});

// Schedule a status update job
// Update the schedule function to support admin offers
const scheduleOfferStatusUpdate = async (offerId, newStatus, scheduleTime, isAdminOffer = false) => {
  const delay = new Date(scheduleTime).getTime() - Date.now();
  
  // Choose the appropriate model based on the flag
  const OfferModel = isAdminOffer ? AdminOffer : Offer;
  
  if (delay < 0) {
    const offer = await OfferModel.findById(offerId);
    if (offer) {
      offer.status = newStatus;
      await offer.save();
      console.log(`Immediately updated ${isAdminOffer ? 'Admin' : 'Restaurant'} offer ${offerId} status to ${newStatus}`);

      const io = require('../server').get('io');
      if (io) {
        if (isAdminOffer) {
          // Broadcast to admin channel
          io.to('admin-channel').emit('adminOfferStatusUpdate', {
            offerId: offer._id,
            status: newStatus
          });
        } else {
          // Original notification
          io.to(offer.restaurantId.toString()).emit('offerStatusUpdate', {
            offerId: offer._id,
            status: newStatus
          });
        }
      }
    }
    return;
  }

  await offerStatusQueue.add(
    { offerId, newStatus, isAdminOffer },
    {
      delay,
      jobId: `${isAdminOffer ? 'admin' : 'rest'}-${offerId}-${newStatus}`,
      attempts: 3,
      backoff: 5000,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
};

// Cancel existing jobs for an offer
// Update the cancel function to support admin offers
const cancelOfferStatusJobs = async (offerId, isAdminOffer = false) => {
  const statuses = ['Active', 'Scheduled', 'Inactive'];
  const prefix = isAdminOffer ? 'admin' : 'rest';
  
  for (const status of statuses) {
    try {
      await offerStatusQueue.removeJobs(`${prefix}-${offerId}-${status}`);
      console.log(`Canceled job for ${isAdminOffer ? 'admin' : 'restaurant'} offer ${offerId} to ${status}`);
    } catch (error) {
      console.log(`No job found for ${isAdminOffer ? 'admin' : 'restaurant'} offer ${offerId} to ${status}`);
    }
  }
};

// Handle failed jobs
offerStatusQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed for offer ${job.data.offerId} after ${job.attemptsMade} attempts:`, error.message);
});

// Recovery mechanism for scheduled jobs
const recoverScheduledJobs = async () => {
  try {
    console.log('Recovering scheduled jobs...');
    const now = new Date();
    const offers = await Offer.find({
      $or: [
        { status: 'Scheduled', validFrom: { $gt: now } },
        { status: 'Active', validTo: { $gt: now } },
      ],
    });

    for (const offer of offers) {
      await cancelOfferStatusJobs(offer._id);
      if (offer.status === 'Scheduled') {
        await scheduleOfferStatusUpdate(offer._id, 'Active', offer.validFrom);
      }
      if (new Date(offer.validTo) > now) {
        await scheduleOfferStatusUpdate(offer._id, 'Inactive', offer.validTo);
      }
    }
    console.log('Scheduled jobs recovered.');
  } catch (error) {
    console.error('Error recovering scheduled jobs:', error.message);
  }
};

// Run recovery when the queue starts
offerStatusQueue.on('ready', () => {
  console.log(`Offer status queue started with Redis Cloud (without TLS)`);
  recoverScheduledJobs();
});

module.exports = { offerStatusQueue, scheduleOfferStatusUpdate, cancelOfferStatusJobs };