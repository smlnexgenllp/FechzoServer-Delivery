const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db.js');
const { offerStatusQueue } = require('./queues/offerStatusQueue');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
// Load environment variables
dotenv.config();

// Base URLs for frontend and backend based on environment
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URLS = {
  frontend: isProduction
  ? [
      'https://fechzo.com',
      'https://www.fechzo.com',
      'capacitor://localhost'
    ]
  : [
      'http://localhost:5173',
      'capacitor://localhost'
    ],

  backend: isProduction
    ? 'https://fechzoserver.onrender.com'
    : 'http://localhost:5000',
};
 

// Make base URLs globally accessible
global.baseURLs = BASE_URLS;

const app = express();

// Create HTTP server for socket.io
const server = http.createServer(app);

// Set up socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: BASE_URLS.frontend,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (BASE_URLS.frontend.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'restaurant-id', 'X-Requested-With'],
  credentials: true,
};

app.use(cors(corsOptions));

// Helmet for basic security
app.use(helmet());

// Body parser middleware for JSON
app.use(express.json());
app.use(cookieParser());
// Parses URL-encoded data
app.use(express.urlencoded({ extended: true }));
// Handle preflight requests (OPTIONS) dynamically
app.options('*', cors(corsOptions));

// Set up bull-board for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(offerStatusQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Handle WebSocket connections
io.on('connection', (socket) => {

  // Handle client joining a branch-specific room
  // socket.on('joinBranch', (branchId) => {
  //   socket.join(branchId);
  //   console.log(`Client ${socket.id} joined branch room: ${branchId}`);
  //   // Emit a confirmation to the client
  //   socket.emit('joinedBranch', branchId);
  // });
  socket.on('actionTaken', (data) => {
    console.log('Emitting actionTaken event:', data); // Debug log
    io.to(data.restaurantId).emit('actionTaken', {
      ...data,
      restaurantId: data.restaurantId.toString(), // Ensure string for consistency
    });
    if (data.action === 'suspension' || data.action === 'block') {
      io.to(data.restaurantId).emit('adminAction', {
        type: data.action,
        restaurantId: data.restaurantId.toString(),
        reason: data.reason,
        details: data.details
      });
    }
    
    console.log(`Action taken for restaurant ${data.restaurantId}:`, data.action);
  });


  socket.on('disconnect', () => {
  });
  socket.on('joinRestaurant', (restaurantId) => {
    if (restaurantId) {
      console.log(`Socket ${socket.id} joining restaurant room: ${restaurantId}`);
      socket.join(restaurantId.toString());
    }
  });
  

  socket.on('leaveRestaurant', (restaurantId) => {
    socket.leave(restaurantId);
    console.log(`Client ${socket.id} left restaurant room: ${restaurantId}`);
  });

  socket.on('joinAdminChannel', () => {
    socket.join('admin-channel');
    console.log(`Client ${socket.id} joined admin channel`);
    socket.emit('joinedAdminChannel');
  });
  
  socket.on('leaveAdminChannel', () => {
    socket.leave('admin-channel');
    console.log(`Client ${socket.id} left admin channel`);
  });
  
});

// Make io accessible globally or pass it to routes if needed
app.set('io', io);

// Import routes
const userRoutes = require('./routes/users/userRoutes');
const restaurantRoutes = require('./routes/restaurants/restaurantRoutes');
const deliveryRoutes = require('./routes/delivery/deliveryRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const foodRoutes = require('./routes/food/foodRoutes');
const authRoutes = require('./routes/auth/authRoutes');
const adminnotificationRoutes = require('./routes/admin/adminnotificationRoutes');
// server.js (partial)
const outletRoutes = require('./routes/restaurants/outlet/outletRoutes');
const adsRoutes = require('./routes/restaurants/ads/Adsroutes');
// const actionLogRoutes = require('./routes/restaurants/actionlog/actionlogroutes');
const deliveryPartnerRoutes = require("./routes/delivery/deliveryPartner.routes.js");
const deliveryPartnerOrderRoutes = require(
  "./routes/deliveryPartner/order.routes"
);
const partnerRoutes = require("./routes/partner/index.js");
const { acceptInvite } = require("./controllers/restaurants/outlet/ContactController.js");
const razorpayRoutes = require('./routes/razorpay/RazorPayRoutes.js')
const notificationRoutes = require('./routes/restaurants/notificationRoutes');
const mapsRoutes = require('./routes/maps');
// const offerRoutes = require('./routes/offers/offerRoutes');
// const branchRoutes = require('./routes/branches/branchRoutes');
// const performanceRoutes = require('./routes/performance/performanceRoutes');
// const numbersRoutes = require('./routes/outlet/numbersRoutes');
// const shopRoutes = require('./routes/shops/shopRoutes');

require('./controllers/restaurants/Logcontroller/AutoFinalizeOperatingHoursJob');
require('./controllers/restaurants/Logcontroller/AutoOpenOperatingHoursJob');

// Establish database connection
connectDB()
  .then(() => {
    // Use routesl
    app.use('/api/users', userRoutes);
    app.use('/api/restaurants', restaurantRoutes);
    app.use('/api/delivery', deliveryRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/food', foodRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/outlet', outletRoutes);
    // app.use('/api/restaurants/controls', actionLogRoutes);
    

    app.use('/api/restaurantsz', adsRoutes);
    app.post("/api/restaurants/accept-invite", acceptInvite);
    app.use('/api/razorpay', razorpayRoutes);
    app.use('/api/restaurant/notifications', notificationRoutes);
    app.use('/api/admin/notifications', adminnotificationRoutes);
    app.use('/api/maps', mapsRoutes);
    app.use("/api/delivery-partner", deliveryPartnerRoutes);
    app.use("/api/partner", partnerRoutes);
    // app.use('/api/offers', offerRoutes);
    // app.use('/api/restaurants', branchRoutes);
    // app.use('/api/performance', performanceRoutes);

    // app.use('/api/shops', shopRoutes);

    app.use("/api/partner", require("./routes/partner/index.js"));
    
    app.use("/api/delivery-partner/orders", deliveryPartnerOrderRoutes);
    // Root route - serves the landing page
    app.get('/', (req, res) => {
      res.send("Welcome to Fechzo");
    });

    // Start the server only after DB connection is successful
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);  // Exit with failure if DB connection fails
  });

module.exports = app;
