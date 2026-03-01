import express from 'express';
import path from 'path';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for serving static files (CSS, JS, etc.)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Route for image transformations
app.get('/image-transform', async (req, res) => {
    const { path: imagePath, format, width, height } = req.query;
    try {
        const transformedImage = await sharp(imagePath)
            .resize(parseInt(width), parseInt(height))
            .toFormat(format)
            .toBuffer();
        res.type(format);
        res.send(transformedImage);
    } catch (error) {
        res.status(500).send('Error processing image');
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('Welcome to the image transformation and static serving API!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});