/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        qualities: [75, 90],
        remotePatterns: [{
            protocol: 'https',
            hostname: 'images.unsplash.com',
        }],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    headers: async() => [{
        source: '/:path*',
        headers: [{
                key: 'X-Content-Type-Options',
                value: 'nosniff',
            },
            {
                key: 'X-Frame-Options',
                value: 'DENY',
            },
            {
                key: 'Referrer-Policy',
                value: 'strict-origin-when-cross-origin',
            },
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=()',
            },
            ...(process.env.NODE_ENV === 'production' ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000',
            }] : []),
        ],
    }, ],
}

module.exports = nextConfig