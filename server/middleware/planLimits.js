import prisma from '../database/db.js';

export const PLAN_LIMITS = {
  TRIAL: { maxUsers: 2, maxCases: 10, maxStorageMB: 500, maxAIRequests: 20 },
  STARTER: { maxUsers: 3, maxCases: null, maxStorageMB: 5120, maxAIRequests: 100 },
  PROFESSIONAL: { maxUsers: 10, maxCases: null, maxStorageMB: 25600, maxAIRequests: 500 },
  ENTERPRISE: { maxUsers: null, maxCases: null, maxStorageMB: 102400, maxAIRequests: null }
};

export const checkPlanLimit = (resource) => {
  return async (req, res, next) => {
    try {
      const tenant = req.tenant;
      if (!tenant) {
        return res.status(401).json({ message: 'المساحة غير محددة' });
      }

      const plan = tenant.plan ? tenant.plan.toUpperCase() : 'TRIAL';
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.TRIAL;
      
      let limit;
      let currentUsage = 0;

      switch(resource) {
        case 'users':
          limit = limits.maxUsers;
          if (limit !== null) {
            currentUsage = await prisma.user.count({ where: { tenantId: tenant.id } });
          }
          break;
        case 'cases':
          limit = limits.maxCases;
          if (limit !== null) {
            currentUsage = await prisma.case.count({ where: { tenantId: tenant.id } });
          }
          break;
        case 'storage':
          limit = limits.maxStorageMB;
          if (limit !== null) {
            currentUsage = tenant.storageUsedMB || 0; 
          }
          break;
        case 'ai_requests':
          limit = limits.maxAIRequests;
          if (limit !== null) {
            currentUsage = tenant.aiRequestsCount || 0;
          }
          break;
        default:
          return next();
      }

      if (limit !== null && currentUsage >= limit) {
        return res.status(403).json({
          message: 'لقد تجاوزت الحد المسموح به في باقتك الحالية. يرجى ترقية الباقة للمتابعة.',
          upgradeRequired: true
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking plan limit for ${resource}:`, error);
      res.status(500).json({ message: 'حدث خطأ أثناء فحص حدود الباقة' });
    }
  };
};
