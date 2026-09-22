const sanitize = (val) => (typeof val === 'string' ? val.trim() : val);

export const validateLogin = (req, res, next) => {
    if (req.body.email) req.body.email = sanitize(req.body.email);
    if (req.body.password) req.body.password = sanitize(req.body.password);
    
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' });
    }
    next();
};

export const validateClient = (req, res, next) => {
    if (req.body.name) req.body.name = sanitize(req.body.name);
    
    if (!req.body.name) {
        return res.status(400).json({ success: false, message: 'اسم الموكل مطلوب' });
    }
    next();
};

export const validateCase = (req, res, next) => {
    if (req.body.case_number) req.body.case_number = sanitize(req.body.case_number);
    if (req.body.title) req.body.title = sanitize(req.body.title);
    
    if (!req.body.case_number || !req.body.title || !req.body.client_id) {
        return res.status(400).json({ success: false, message: 'رقم القضية، عنوان القضية، ومعرف الموكل مطلوبون' });
    }
    next();
};

export const validateTask = (req, res, next) => {
    if (req.body.title) req.body.title = sanitize(req.body.title);
    
    if (!req.body.title || !req.body.assigned_to) {
        return res.status(400).json({ success: false, message: 'عنوان المهمة والشخص المسند إليه المهمة مطلوبون' });
    }
    next();
};

export const validateEvent = (req, res, next) => {
    if (req.body.title) req.body.title = sanitize(req.body.title);
    
    if (!req.body.title || !req.body.date) {
        return res.status(400).json({ success: false, message: 'عنوان الحدث والتاريخ مطلوبون' });
    }
    next();
};
