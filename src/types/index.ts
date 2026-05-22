export type CourseMode = "On-Site" | "Online" | "Private" | "Online Private";

export type CoursePrice = {
  mode: CourseMode;
  price: string;
  duration: string;
};

export type Course = {
  level: string;
  title: string;
  prices: CoursePrice[];
  description: string;
  outcomes: string[];
};

export type Feature = {
  title: string;
  description: string;
  eyebrow: string;
};

export type FAQ = {
  question: string;
  answer: string;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

export type StaffMember = {
  name: string;
  role: string;
};

export type WebsiteSection = {
  title: string;
  description: string;
};
