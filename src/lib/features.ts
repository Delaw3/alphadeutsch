/**
 * Single registry of app features. The Home screen renders one tile per
 * entry, so adding a feature is one entry here plus its page/endpoint.
 *
 * `requiresStudent` marks features whose outcome is tied to a verified
 * student record (users.stud2022_id). Tiles are still visible to everyone;
 * the feature page itself handles the not-linked state (inline verify or
 * student-details step). Never derive roles from stud2022.adminlevel.
 */
export type Feature = {
  id: string;
  title: string;
  icon: string;
  route: string | null;
  requiresStudent: boolean;
};

export const features: Readonly<Feature[]> = [
  {
    id: "check-result",
    title: "Check result",
    icon: "🎓",
    route: "/result",
    requiresStudent: true,
  },
  {
    id: "register-course",
    title: "Register for a course",
    icon: "📝",
    route: "/register",
    requiresStudent: false,
  },
  {
    id: "my-courses",
    title: "My courses",
    icon: "📘",
    route: "/my-courses",
    requiresStudent: true,
  },
  {
    id: "coming-soon",
    title: "More coming soon",
    icon: "🚧",
    route: null,
    requiresStudent: false,
  },
] as const;

export function findFeature(id: string): Feature | undefined {
  return features.find((f) => f.id === id);
}
