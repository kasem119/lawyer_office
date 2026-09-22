const loginMap = new Map();
const apiMap = new Map();

// Cleanup expired entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of loginMap.entries()) {
        if (value.resetTime < now) loginMap.delete(key);
    }
    for (const [key, value] of apiMap.entries()) {
        if (value.resetTime < now) apiMap.delete(key);
    }
}, 5 * 60 * 1000);

const createLimiter = (map, limit, windowMs, message) => {
    return (req, res, next) => {
        if (process.env.NODE_ENV === 'test') return next();
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        
        let record = map.get(ip);
        if (!record || record.resetTime < now) {
            record = { count: 1, resetTime: now + windowMs };
            map.set(ip, record);
            return next();
        }
        
        record.count++;
        if (record.count > limit) {
            return res.status(429).json({
                success: false,
                message: message
            });
        }
        next();
    };
};

export const loginLimiter = createLimiter(
    loginMap,
    5,
    15 * 60 * 1000,
    'تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة لاحقاً بعد 15 دقيقة.'
);

export const apiLimiter = createLimiter(
    apiMap,
    100,
    60 * 1000,
    'تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً.'
);
