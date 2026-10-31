export const siteLinks = {
  // Website pages opened by the in-app browser while FEATURE_APP_REGISTRATION is off.
  registration:
    process.env.NEXT_PUBLIC_SITE_REGISTRATION_URL?.trim() ||
    "https://portal.alphadeutsch.com/registration",
  payment:
    process.env.NEXT_PUBLIC_SITE_PAYMENT_URL?.trim() ||
    "https://portal.alphadeutsch.com/payment.php",
};

export const siteConfig = {
  name: "Alpha Deutsch",
  description:
    "Alpha Deutsch mobile learning app: explore German courses, learning updates, and support.",
  url: "https://alphadeutsch.example",
  phone: "+234 816 545 5895",
  phoneAlt: "+234 905 668 4923",
  email: "contact@alphadeutsch.com",
  emailAlt: "info@alphadeutsch.com",
  address: "St. Lucy Outstation, 259 Ifite Road, Awka, Anambra State, Nigeria.",
};
