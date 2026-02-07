const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/distance', async (req, res) => {
    const { origins, destinations } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=two_wheeler&key=${apiKey}`;

    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch distance' });
    }
});

module.exports = router;