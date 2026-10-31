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
