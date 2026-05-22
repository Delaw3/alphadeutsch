import { siteConfig } from "@/lib/constants";

const courseOptions = [
  "A1 Elementary - On-Site",
  "A1 Elementary - Online Private",
  "A1 Elementary - Private",
  "A1 Elementary - Online",
  "A2 Elementary - On-Site",
  "A2 Elementary - Online Private",
  "A2 Elementary - Private",
  "A2 Elementary - Online",
  "B1 Independent - On-Site",
  "B1 Independent - Online",
  "B1 Independent - Private",
  "B1 Independent - Online Private",
  "B2 Independent - On-Site",
  "B2 Independent - Online",
  "B2 Independent - Private",
  "B2 Independent - Online Private",
  "C1 Autonomous - On-Site",
  "C1 Autonomous - Online",
  "C1 Autonomous - Private",
  "C1 Autonomous - Online Private",
  "Family Reunion - On-Site",
  "Family Reunion - Online",
  "Family Reunion - Private",
  "Family Reunion - Online Private",
];

const sittingOptions = ["1st Sitting", "2nd Sitting", "3rd Sitting", "4th Sitting", "5th Sitting"];

function FieldIcon({ type }: { type: "user" | "course" | "calendar" | "key" }) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 19c.7-3.1 2.7-5 6-5s5.3 1.9 6 5" />
      </>
    ),
    course: (
      <>
        <path d="M4 7l8 5 8-5" />
        <path d="M4 7v10h16V7" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11H4V7a2 2 0 0 1 2-2Z" />
        <path d="M8 13h2M12 13h2M16 13h2M8 16h2M12 16h2" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="12" r="3" />
        <path d="M11 12h9M15 12v3M18 12v2" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-2">
      {paths[type]}
    </svg>
  );
}

export function PortalPreview() {
  return (
    <section className="portal-form-card mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/10">
      <div className="grid lg:grid-cols-[1fr_0.36fr]">
        <form className="p-5 sm:p-7 lg:p-8">
          <div className="flex justify-center">
            <span className="relative block h-16 w-20">
              <img
                src={siteConfig.logos.lightTheme}
                alt="Alpha Deutsch"
                className="site-logo-dark h-full w-full object-contain"
              />
              <img
                src={siteConfig.logos.darkTheme}
                alt="Alpha Deutsch"
                className="site-logo-white h-full w-full object-contain"
              />
            </span>
          </div>

          <h2 className="mt-6 text-center text-xl font-black text-[#0a1224]">Student&apos;s Result Portal</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-slate-500">
            Enter your registration details to preview result access. This form is static for now.
          </p>

          {/* Future NestJS integration: submit registration number, course, date of birth, and sitting to result lookup endpoint. */}
          <div className="mt-7 grid gap-4">
            <label className="grid gap-2">
              <span className="sr-only">Registration Number</span>
              <span className="portal-field flex min-h-12 overflow-hidden rounded-2xl border border-indigo-100 bg-white text-slate-700 transition focus-within:-translate-y-0.5 focus-within:border-indigo-500 focus-within:shadow-lg focus-within:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="grid w-12 place-items-center border-r border-indigo-100 bg-indigo-50/70">
                  <FieldIcon type="user" />
                </span>
                <input className="min-w-0 flex-1 px-4 text-sm outline-none" placeholder="Registration Number" />
              </span>
            </label>

            <label className="grid gap-2">
              <span className="sr-only">Select Course</span>
              <span className="portal-field flex min-h-12 overflow-hidden rounded-2xl border border-indigo-100 bg-white text-slate-700 transition focus-within:-translate-y-0.5 focus-within:border-indigo-500 focus-within:shadow-lg focus-within:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="grid w-12 place-items-center border-r border-indigo-100 bg-indigo-50/70">
                  <FieldIcon type="course" />
                </span>
                <select className="min-w-0 flex-1 bg-white px-4 text-sm outline-none">
                  <option>Select Course</option>
                  {courseOptions.map((course) => (
                    <option key={course}>{course}</option>
                  ))}
                </select>
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#0a1224]">Date of Birth:</span>
              <span className="portal-field flex min-h-12 overflow-hidden rounded-2xl border border-indigo-100 bg-white text-slate-700 transition focus-within:-translate-y-0.5 focus-within:border-indigo-500 focus-within:shadow-lg focus-within:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="grid w-12 place-items-center border-r border-indigo-100 bg-indigo-50/70">
                  <FieldIcon type="calendar" />
                </span>
                <input className="min-w-0 flex-1 px-4 text-sm outline-none" type="date" />
              </span>
            </label>

            <label className="grid gap-2">
              <span className="sr-only">Select Sitting</span>
              <span className="portal-field flex min-h-12 overflow-hidden rounded-2xl border border-indigo-100 bg-white text-slate-700 transition focus-within:-translate-y-0.5 focus-within:border-indigo-500 focus-within:shadow-lg focus-within:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="grid w-12 place-items-center border-r border-indigo-100 bg-indigo-50/70">
                  <FieldIcon type="key" />
                </span>
                <select className="min-w-0 flex-1 bg-white px-4 text-sm outline-none">
                  <option>Select Sitting</option>
                  {sittingOptions.map((sitting) => (
                    <option key={sitting}>{sitting}</option>
                  ))}
                </select>
              </span>
            </label>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="focus-ring min-h-12 rounded-full bg-indigo-500 px-8 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-500/30"
            >
              Check Result
            </button>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
            <a href="/courses" className="text-sm font-semibold text-indigo-500 transition hover:text-indigo-700">
              New Student? Click to get started
            </a>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <a
              href="/courses"
              className="focus-ring inline-flex min-h-12 items-center rounded-full bg-[#ff1616] px-7 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-[#d90000]"
            >
              Add New Course/Pay
            </a>
          </div>

          <div className="portal-notice mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
            <h3 className="text-2xl font-black text-blue-600">Important Notice</h3>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#0a1224]">
              <strong>Note:</strong> To access your results, you must have fully paid your course fees.
              <br />
              If you encounter any issues with the result portal, please{" "}
              <a href="/contact" className="font-black text-blue-600 hover:text-blue-700">
                contact your instructor
              </a>
              .
            </p>
          </div>
        </form>

        <div
          className="hidden bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(10, 18, 36, 0.16), rgba(10, 18, 36, 0.42)), url(https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/3.png)",
          }}
        />
      </div>
    </section>
  );
}
