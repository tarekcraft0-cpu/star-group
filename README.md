# STAR — موقع قروب ستار

موقع عربي لتقييم أدمنية القروب، مع ظهور الآراء للجميع.

## التشغيل

```bash
npm install
npm start
```

ثم افتح: [http://localhost:3000](http://localhost:3000)

## تعديل الأدمنية

عدّل الملف `data/admins.json`:

```json
[
  {
    "id": "admin-1",
    "name": "اسم الأدمن",
    "username": "@username",
    "role": "مشرف عام",
    "avatar": ""
  }
]
```

بعد التعديل أعد تشغيل السيرفر أو حدّث الصفحة.
