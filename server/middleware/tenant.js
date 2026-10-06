import prisma from '../database/db.js';
import { PLATFORM_DOMAIN } from '../config.js';

export const resolveTenant = async (req, res, next) => {
  try {
    let tenant = null;

    // 1. Try to get tenant from authenticated user's JWT (set in auth middleware)
    if (req.user && req.user.tenantId) {
      tenant = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId }
      });
    }

    // 2. Fallback to subdomain extraction
    if (!tenant) {
      const host = req.headers.host || '';
      let slug = null;

      if (host.includes(PLATFORM_DOMAIN) && host !== PLATFORM_DOMAIN && host !== `www.${PLATFORM_DOMAIN}`) {
        slug = host.split('.')[0];
      } else {
        // Optional fallback headers for testing/dev
        slug = req.headers['x-tenant-slug'] || req.query.tenant;
      }

      if (slug) {
        tenant = await prisma.tenant.findUnique({
          where: { slug }
        });
      }
    }

    // Return 404 if tenant not found
    if (!tenant) {
      return res.status(404).json({ message: 'المساحة غير موجودة' });
    }

    // Check if tenant is active
    // Assuming isActive boolean field, or status field
    if (tenant.isActive === false || tenant.status === 'INACTIVE') {
      return res.status(403).json({ message: 'المساحة غير مفعلة' });
    }

    // Check if subscription is not expired (allow grace period of 7 days)
    if (tenant.subscriptionEndsAt) {
      const endDate = new Date(tenant.subscriptionEndsAt);
      endDate.setDate(endDate.getDate() + 7); // 7 days grace period
      
      if (new Date() > endDate) {
        return res.status(402).json({ message: 'انتهت صلاحية الاشتراك' });
      }
    }

    // Attach tenant to request
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء التحقق من المساحة' });
  }
};
