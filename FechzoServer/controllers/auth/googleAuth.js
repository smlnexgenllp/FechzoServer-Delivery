const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../../models/User/User'); // Your User model
const dotenv = require('dotenv');
dotenv.config();
// In your main server file, set up the dynamic redirect URI
const googleRedirectURI = `${global.baseURLs.backend}${process.env.GOOGLE_REDIRECT_PATH}`;

// Initialize OAuth2Client with Client ID, Client Secret, and Redirect URI
const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectURI 
);

// Route to start the OAuth flow
const googleAuth = (req, res) => {


    const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        prompt: 'consent', // Ensures refresh tokens are received
    });

    console.log('Redirecting to:', authUrl);
    res.redirect(authUrl);
};

// Callback route after user authentication
const googleCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        console.error('Error: Code is missing in the callback request');
        return res.status(400).json({ message: 'Code is required for authentication.' });
    }

    try {
        // Exchange authorization code for tokens
        console.log('Exchanging code for tokens...');
        const { tokens } = await client.getToken(code);
        console.log('Tokens received:', tokens);
        client.setCredentials(tokens);

        // Get user info from Google
        const { data: googleUser } = await client.request({ url: 'https://www.googleapis.com/oauth2/v3/userinfo' });
        console.log('Google user data:', googleUser);

        // Check if the user exists in the database by email
        let user = await User.findOne({ email: googleUser.email });
        console.log('User found in database:', user);

        if (!user) {
            console.log('User not found, creating a new one...');
            // If user doesn't exist, create a new one
            user = new User({
                googleId: googleUser.sub,
                name: googleUser.name,
                email: googleUser.email,
                profilePicture: googleUser.picture
            });

            await user.save();
            console.log('New user saved to database:', user);
        } else {
            // Update fields if they differ from the existing user data
            let hasUpdates = false;
            if (user.googleId !== googleUser.sub) {
                user.googleId = googleUser.sub;
                hasUpdates = true;
            }
            if (user.name !== googleUser.name) {
                user.name = googleUser.name;
                hasUpdates = true;
            }
            if (user.profilePicture !== googleUser.picture) {
                user.profilePicture = googleUser.picture;
                hasUpdates = true;
            }

            // Update last_logged_in field
            user.last_logged_in = new Date();

            // Save only if there were changes
            if (hasUpdates) {
                await user.save();
                console.log('User updated with new Google data:', user);
            } else {
                console.log('No changes detected in user data, only last_logged_in updated.');
            }
        }

        // Generate JWT token
        console.log('Generating JWT token...');
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('JWT token generated:', token);

        // Redirect to frontend with token and user data
        res.redirect(`${global.baseURLs.frontend}/?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);

        console.log('Redirecting to frontend with token and user data.');

    } catch (error) {
        console.error('Error during Google Authentication:', error.response ? error.response.data : error.message);
        res.status(500).json({
            message: 'Authentication failed, please try again later.',
            error: error.response ? error.response.data.error : error.message
        });
    }
};


module.exports = { googleAuth, googleCallback };
