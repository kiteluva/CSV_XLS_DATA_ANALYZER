require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_API_BASE_URL;
const EXTERNAL_API_KEY_NAME = process.env.EXTERNAL_API_KEY_NAME;
const EXTERNAL_API_KEY_VALUE = process.env.EXTERNAL_API_KEY_VALUE;

// Enable CORS for your PWA's origin
// IMPORTANT: Replace with your PWA's actual deployed URL(s) in production!
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'], // Assuming PWA runs on 8080 with live-server
    credentials: true
}));

// Add JSON body parsing
app.use(express.json());

// Proxy for External AI API calls (e.g., Gemini)
app.use('/api/ai', createProxyMiddleware({
    target: EXTERNAL_API_BASE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/ai': '/', // e.g., /api/ai/v1beta/models/gemini... becomes /v1beta/models/gemini... at target
    },
    onProxyReq: (proxyReq, req, res) => {
        // Add API key as a query parameter for Gemini
        if (EXTERNAL_API_KEY_NAME && EXTERNAL_API_KEY_VALUE) {
            const url = new URL(proxyReq.path, EXTERNAL_API_BASE_URL);
            url.searchParams.append(EXTERNAL_API_KEY_NAME, EXTERNAL_API_KEY_VALUE);
            proxyReq.path = url.pathname + url.search;
        }

        // If the original request body was JSON, re-write it to the proxy request
        if (req.body) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
        console.log(`[Node Proxy] Proxying AI request to: ${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error('AI Proxy error:', err);
        res.status(500).send('AI Proxy Error: Could not connect to external service.');
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Node Proxy] AI response status: ${proxyRes.statusCode}`);
    }
}));

// Proxy for Flask Backend (data calculations)
// Assuming Flask runs on port 5000
app.use('/api/flask', createProxyMiddleware({
    target: 'http://localhost:5000',
    changeOrigin: true,
    pathRewrite: {
        '^/api/flask': '/', // e.g., /api/flask/calculate_correlation becomes /calculate_correlation at Flask target
    },
    onError: (err, req, res) => {
        console.error('Flask Proxy error:', err);
        res.status(500).send('Flask Proxy Error: Could not connect to Flask service.');
    }
}));

app.get('/', (req, res) => {
    res.send('Node.js API Proxy is running!');
});

app.listen(PORT, () => {
    console.log(`Node.js API Proxy listening on port ${PORT}`);
});