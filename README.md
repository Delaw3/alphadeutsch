# Alpha Deutsch Frontend Prototype

Modern frontend-only rebrand prototype for Alpha Deutsch, a Nigerian-based German language and culture learning center. The app uses the Next.js App Router, TypeScript, Tailwind CSS, ESLint, reusable components, static data, and SEO metadata.

## Run the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

For production checks:

```bash
npm run lint
npm run build
```

## Pages created

- Home: real headline, course preview, website sections, course process, result portal preview, testimonials, FAQ, stats, and contact CTA.
- About: real institute positioning, culture-learning mission, and stats.
- Courses: static course cards for A1, A2, B1, B2, C1, and Family Reunion with grouped learning modes and prices.
- Study in Germany: static pathway concept for German learning, admissions support, and visa application preparation.
- Staff: static staff directory.
- Result Portal Preview: dashboard mockup with profile, enrolled course, progress, attendance, payment status, schedule, notifications, and scores.
- Contact: static contact form preview with real address, phone numbers, and emails.

## Static for now

This prototype has no backend integration, authentication, database connection, API calls, payment processing, or real student login. Course data, FAQs, testimonials, staff, website sections, portal values, contact details, schedules, and notifications are stored locally as static frontend content.

Static data currently lives in:

- `src/data/courses.ts`
- `src/data/features.ts`
- `src/data/faqs.ts`
- `src/data/staff.ts`
- `src/data/testimonials.ts`
- `src/data/website-sections.ts`

## Future NestJS integration

The app is structured so a NestJS backend can later connect through a service layer under `src/lib` or feature-specific modules. Likely integration points include:

- Course catalog, pricing, cohorts, and enrollment availability.
- Contact enquiry submission and lead management.
- Student/result portal authentication and profile data.
- Course progress, attendance, schedules, payment status, notifications, and exam scores.
- Admin-controlled content for FAQs, testimonials, staff, gallery, blog, and study pathway updates.

Inline comments mark the main places where static frontend content can later be replaced by API-backed data.
